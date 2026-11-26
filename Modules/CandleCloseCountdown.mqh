// CANDLE CLOSE COUNTDOWN MODULE
// Reuses the Expert Advisor's centralized timer and chart-event dispatcher.
//+------------------------------------------------------------------+
//| CandleCloseCountdown.mq5                                         |
//| ChartMasters - Candle close countdown for MetaTrader 5          |
//+------------------------------------------------------------------+

input group "Candle countdown"
input int InpCCT_MaxTickAgeSeconds = 300; // Suppress countdown when quote data is stale

// Broker-time clock anchored to the latest quote, then advanced locally.
// This keeps the countdown in the same time base as the chart candles.
string          g_cct_clock_symbol = "";
datetime        g_cct_clock_base_server_time = 0;
uint            g_cct_clock_base_local_ms = 0;
long            g_cct_last_tick_time_msc = 0;

//+------------------------------------------------------------------+
//| Convert seconds to MM:SS or HH:MM:SS                             |
//+------------------------------------------------------------------+
string CCT_FormatCountdown(const long total_seconds)
{
   long seconds = total_seconds;
   if(seconds < 0)
      seconds = 0;

   int hours   = (int)(seconds / 3600);
   int minutes = (int)((seconds % 3600) / 60);
   int secs    = (int)(seconds % 60);

   if(hours > 0)
      return StringFormat("%02d:%02d:%02d", hours, minutes, secs);

   return StringFormat("%02d:%02d", minutes, secs);
}

//+------------------------------------------------------------------+
//| Human-readable timeframe label                                   |
//+------------------------------------------------------------------+
string CCT_TimeframeLabel(const ENUM_TIMEFRAMES timeframe)
{
   string label = EnumToString(timeframe);
   StringReplace(label, "PERIOD_", "");
   return label;
}

//+------------------------------------------------------------------+
//| Calculate the close time of the current bar                      |
//+------------------------------------------------------------------+
datetime CCT_CurrentBarCloseTime(const ENUM_TIMEFRAMES timeframe,
                             const datetime bar_open)
{
   // A calendar month is not always 30 days. Calculate MN1 exactly.
   if(timeframe == PERIOD_MN1)
   {
      MqlDateTime parts;
      if(!TimeToStruct(bar_open, parts))
         return 0;

      parts.day  = 1;
      parts.hour = 0;
      parts.min  = 0;
      parts.sec  = 0;
      parts.mon++;
      if(parts.mon > 12)
      {
         parts.mon = 1;
         parts.year++;
      }
      return StructToTime(parts);
   }

   int seconds = PeriodSeconds(timeframe);
   if(seconds <= 0)
      return 0;

   return bar_open + seconds;
}

//+------------------------------------------------------------------+
//| Check whether current time is inside a quote session             |
//| has_schedule=false means broker supplied no schedule for the     |
//| checked days; live-tick freshness is then used as a fallback.    |
//+------------------------------------------------------------------+
bool CCT_IsInsideQuoteSession(const string symbol,
                          const datetime now,
                          bool &has_schedule)
{
   has_schedule = false;

   MqlDateTime now_parts;
   if(!TimeToStruct(now, now_parts))
      return false;

   int seconds_today = now_parts.hour * 3600 + now_parts.min * 60 + now_parts.sec;
   datetime today_midnight = now - seconds_today;

   // Check today's sessions and yesterday's sessions to support
   // sessions that continue past midnight.
   for(int day_offset = 0; day_offset >= -1; day_offset--)
   {
      datetime session_day = today_midnight + (day_offset * 86400);
      MqlDateTime session_day_parts;
      if(!TimeToStruct(session_day, session_day_parts))
         continue;

      ENUM_DAY_OF_WEEK day = (ENUM_DAY_OF_WEEK)session_day_parts.day_of_week;

      for(uint session_index = 0; session_index < 32; session_index++)
      {
         datetime session_from = 0;
         datetime session_to   = 0;

         if(!SymbolInfoSessionQuote(symbol, day, session_index, session_from, session_to))
            break;

         has_schedule = true;

         datetime session_start = session_day + (long)session_from;
         datetime session_end   = session_day + (long)session_to;

         // Some brokers describe an overnight session with an end
         // time earlier than its start time.
         if(session_end <= session_start)
            session_end += 86400;

         if(now >= session_start && now < session_end)
            return true;
      }
   }

   return false;
}

//+------------------------------------------------------------------+
//| Estimate broker time from the latest quote                       |
//| The local millisecond counter advances between incoming ticks.   |
//+------------------------------------------------------------------+
bool CCT_GetBrokerClock(const string symbol,
                    datetime &server_now,
                    datetime &last_quote_time)
{
   server_now = 0;
   last_quote_time = 0;

   MqlTick tick;
   if(!SymbolInfoTick(symbol, tick))
      return false;

   datetime tick_time = tick.time;
   if(tick_time <= 0 && tick.time_msc > 0)
      tick_time = (datetime)(tick.time_msc / 1000);

   if(tick_time <= 0)
      return false;

   // Reset the clock whenever the chart symbol changes.
   if(g_cct_clock_symbol != symbol)
   {
      g_cct_clock_symbol = symbol;
      g_cct_clock_base_server_time = 0;
      g_cct_clock_base_local_ms = 0;
      g_cct_last_tick_time_msc = 0;
   }

   // Re-anchor only when the broker quote advances to a newer second.
   // This avoids local clock drift while preserving smooth one-second updates.
   if(g_cct_clock_base_server_time <= 0 || tick_time > g_cct_clock_base_server_time)
   {
      g_cct_clock_base_server_time = tick_time;
      g_cct_clock_base_local_ms = GetTickCount();
   }

   if(tick.time_msc > g_cct_last_tick_time_msc)
      g_cct_last_tick_time_msc = tick.time_msc;

   uint elapsed_ms = (uint)(GetTickCount() - g_cct_clock_base_local_ms);
   server_now = g_cct_clock_base_server_time + (datetime)(elapsed_ms / 1000);
   last_quote_time = tick_time;

   long age = (long)server_now - (long)last_quote_time;
   if(age < 0)
      age = 0;

   int max_age = InpCCT_MaxTickAgeSeconds;
   if(max_age < 1)
      max_age = 1;

   return (age <= max_age);
}

//+------------------------------------------------------------------+
//| Create the panel and its text label                              |
//+------------------------------------------------------------------+
bool CCT_CreateCountdownObjects()
{
   // The countdown label is created by the Sessions & News panel.
   return (ObjectFind(0,SN_PREFIX+"candle_timer")>=0);
}

//+------------------------------------------------------------------+
//| Safely set the displayed text                                     |
//+------------------------------------------------------------------+
void CCT_SetStatusText(const string text)
{
   color status_color=C_ACCENT;
   if(StringFind(text,"منتظر")>=0 || StringFind(text,"بسته")>=0 ||
      StringFind(text,"همگام")>=0 || StringFind(text,"داده")>=0)
      status_color=C_WARN;
   SN_SetLabel("candle_timer",text,status_color);
   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Update the countdown                                             |
//+------------------------------------------------------------------+
void CCT_UpdateCountdown()
{
   string symbol = ChartSymbol(0);
   ENUM_TIMEFRAMES timeframe = (ENUM_TIMEFRAMES)ChartPeriod(0);

   if(symbol == "")
      symbol = _Symbol;
   if(timeframe == PERIOD_CURRENT)
      timeframe = _Period;

   string tf_label = CCT_TimeframeLabel(timeframe);

   datetime server_time = 0;
   datetime last_quote_time = 0;
   bool has_fresh_quote = CCT_GetBrokerClock(symbol, server_time, last_quote_time);
   if(server_time <= 0)
   {
      CCT_SetStatusText(tf_label + "   |   منتظر داده بازار");
      return;
   }

   bool has_schedule = false;
   bool session_open = CCT_IsInsideQuoteSession(symbol, server_time, has_schedule);

   // A known closed quote session means there is no active candle countdown.
   if(has_schedule && !session_open)
   {
      CCT_SetStatusText(tf_label + "   |   بازار بسته است");
      return;
   }

   // On holidays or exceptional closures, the broker's weekly session
   // timetable may still say "open". A stale quote suppresses the timer.
   if(!has_fresh_quote)
   {
      CCT_SetStatusText(tf_label + "   |   داده زنده بازار موجود نیست");
      return;
   }
   datetime bar_open_time = iTime(symbol, timeframe, 0);
   if(bar_open_time <= 0)
   {
      CCT_SetStatusText(tf_label + "   |   منتظر داده کندل");
      return;
   }

   int period_seconds = PeriodSeconds(timeframe);
   datetime bar_close_time = CCT_CurrentBarCloseTime(timeframe, bar_open_time);
   if(period_seconds <= 0 || bar_close_time <= 0)
   {
      CCT_SetStatusText(tf_label + "   |   تایم‌فریم پشتیبانی نمی‌شود");
      return;
   }

   // If server quote time and candle history are temporarily out of sync,
   // never show a countdown longer than the selected candle period.
   if(server_time < bar_open_time)
   {
      CCT_SetStatusText(tf_label + "   |   در حال همگام‌سازی کندل");
      return;
   }

   // A stale current-bar timestamp means the next candle has not been
   // received/formed yet. Do not let an M1 chart display 02:00, 03:00, etc.
   if(server_time >= bar_close_time)
   {
      datetime refreshed_bar_open = iTime(symbol, timeframe, 0);
      if(refreshed_bar_open > bar_open_time)
      {
         bar_open_time = refreshed_bar_open;
         bar_close_time = CCT_CurrentBarCloseTime(timeframe, bar_open_time);
      }

      if(bar_close_time <= 0 || server_time >= bar_close_time)
      {
         CCT_SetStatusText(tf_label + "   |   منتظر کندل جدید");
         return;
      }
   }

   long remaining_seconds = (long)bar_close_time - (long)server_time;
   if(remaining_seconds < 0)
      remaining_seconds = 0;
   if(remaining_seconds > period_seconds)
   {
      CCT_SetStatusText(tf_label + "   |   در حال همگام‌سازی کندل");
      return;
   }

   string display_text = "کندل "+tf_label+"  |  بسته‌شدن در "+CCT_FormatCountdown(remaining_seconds);
   CCT_SetStatusText(display_text);
}

//+------------------------------------------------------------------+
//| Indicator initialization                                         |
//+------------------------------------------------------------------+
int CCT_Init()
{
   if(!CCT_CreateCountdownObjects())
   {
      Print("ChartMasters: countdown label is missing from Sessions & News panel.");
      return INIT_FAILED;
   }
   CCT_UpdateCountdown();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Indicator deinitialization                                       |
//+------------------------------------------------------------------+
void CCT_Deinit(const int reason)
{
   // The countdown label belongs to Sessions & News and is removed there.
}

//+------------------------------------------------------------------+
//| Refresh once per second                                          |
//+------------------------------------------------------------------+
void CCT_Timer()
{
   CCT_UpdateCountdown();
}

//+------------------------------------------------------------------+
//| Refresh immediately when chart properties/timeframe change      |
//+------------------------------------------------------------------+
void CCT_ChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_CHART_CHANGE)
      CCT_UpdateCountdown();
}

//+------------------------------------------------------------------+
//| Required calculation event for a custom indicator                |
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
