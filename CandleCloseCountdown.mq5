//+------------------------------------------------------------------+
//| CandleCloseCountdown.mq5                                         |
//| ChartMasters - Candle close countdown for MetaTrader 5          |
//+------------------------------------------------------------------+
#property copyright "ChartMasters"
#property version   "1.20"
#property description "ChartMasters candle close countdown synchronized to broker quote time."
#property indicator_chart_window
#property indicator_buffers 0
#property indicator_plots   0

input int   InpXDistance            = 18;                    // Distance from the right edge
input int   InpYDistance            = 18;                    // Distance from the top edge
input int   InpPanelWidth           = 285;                   // Panel width in pixels
input int   InpPanelHeight          = 42;                    // Panel height in pixels
input color InpPanelBackground      = C'30,41,59';           // Dark panel: readable on light and dark charts
input color InpPanelBorder          = C'56,189,248';         // Cyan border for contrast
input color InpTextColor            = clrWhite;              // Text color
input int   InpFontSize             = 11;                    // Font size
input string InpFont                = "Segoe UI Semibold";  // Font name
input int   InpMaxTickAgeSeconds    = 300;                   // Hide countdown if no fresh quote for this many seconds

string          g_panel_name = "";
string          g_text_name  = "";

// Broker-time clock anchored to the latest quote, then advanced locally.
// This keeps the countdown in the same time base as the chart candles.
string          g_clock_symbol = "";
datetime        g_clock_base_server_time = 0;
uint            g_clock_base_local_ms = 0;
long            g_last_tick_time_msc = 0;

//+------------------------------------------------------------------+
//| Convert seconds to MM:SS or HH:MM:SS                             |
//+------------------------------------------------------------------+
string FormatCountdown(const long total_seconds)
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
string TimeframeLabel(const ENUM_TIMEFRAMES timeframe)
{
   string label = EnumToString(timeframe);
   StringReplace(label, "PERIOD_", "");
   return label;
}

//+------------------------------------------------------------------+
//| Calculate the close time of the current bar                      |
//+------------------------------------------------------------------+
datetime CurrentBarCloseTime(const ENUM_TIMEFRAMES timeframe,
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
bool IsInsideQuoteSession(const string symbol,
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
bool GetBrokerClock(const string symbol,
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
   if(g_clock_symbol != symbol)
   {
      g_clock_symbol = symbol;
      g_clock_base_server_time = 0;
      g_clock_base_local_ms = 0;
      g_last_tick_time_msc = 0;
   }

   // Re-anchor only when the broker quote advances to a newer second.
   // This avoids local clock drift while preserving smooth one-second updates.
   if(g_clock_base_server_time <= 0 || tick_time > g_clock_base_server_time)
   {
      g_clock_base_server_time = tick_time;
      g_clock_base_local_ms = GetTickCount();
   }

   if(tick.time_msc > g_last_tick_time_msc)
      g_last_tick_time_msc = tick.time_msc;

   uint elapsed_ms = (uint)(GetTickCount() - g_clock_base_local_ms);
   server_now = g_clock_base_server_time + (datetime)(elapsed_ms / 1000);
   last_quote_time = tick_time;

   long age = (long)server_now - (long)last_quote_time;
   if(age < 0)
      age = 0;

   int max_age = InpMaxTickAgeSeconds;
   if(max_age < 1)
      max_age = 1;

   return (age <= max_age);
}

//+------------------------------------------------------------------+
//| Create the panel and its text label                              |
//+------------------------------------------------------------------+
bool CreateCountdownObjects()
{
   if(ObjectFind(0, g_panel_name) < 0)
   {
      if(!ObjectCreate(0, g_panel_name, OBJ_RECTANGLE_LABEL, 0, 0, 0))
      {
         Print("ChartMasters: failed to create panel. Error: ", GetLastError());
         return false;
      }
   }

   ObjectSetInteger(0, g_panel_name, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, g_panel_name, OBJPROP_XDISTANCE, InpXDistance);
   ObjectSetInteger(0, g_panel_name, OBJPROP_YDISTANCE, InpYDistance);
   ObjectSetInteger(0, g_panel_name, OBJPROP_XSIZE, InpPanelWidth);
   ObjectSetInteger(0, g_panel_name, OBJPROP_YSIZE, InpPanelHeight);
   ObjectSetInteger(0, g_panel_name, OBJPROP_BGCOLOR, InpPanelBackground);
   ObjectSetInteger(0, g_panel_name, OBJPROP_COLOR, InpPanelBorder);
   ObjectSetInteger(0, g_panel_name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, g_panel_name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, g_panel_name, OBJPROP_BACK, false);
   ObjectSetInteger(0, g_panel_name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, g_panel_name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, g_panel_name, OBJPROP_HIDDEN, true);

   if(ObjectFind(0, g_text_name) < 0)
   {
      if(!ObjectCreate(0, g_text_name, OBJ_LABEL, 0, 0, 0))
      {
         Print("ChartMasters: failed to create text label. Error: ", GetLastError());
         return false;
      }
   }

   ObjectSetInteger(0, g_text_name, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, g_text_name, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, g_text_name, OBJPROP_XDISTANCE, InpXDistance + 12);
   ObjectSetInteger(0, g_text_name, OBJPROP_YDISTANCE, InpYDistance + 13);
   ObjectSetInteger(0, g_text_name, OBJPROP_COLOR, InpTextColor);
   ObjectSetInteger(0, g_text_name, OBJPROP_FONTSIZE, InpFontSize);
   ObjectSetInteger(0, g_text_name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, g_text_name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, g_text_name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, g_text_name, OBJPROP_BACK, false);
   ObjectSetString(0, g_text_name, OBJPROP_FONT, InpFont);
   ObjectSetString(0, g_text_name, OBJPROP_TEXT, "ChartMasters | Starting...");

   return true;
}

//+------------------------------------------------------------------+
//| Safely set the displayed text                                     |
//+------------------------------------------------------------------+
void SetStatusText(const string text)
{
   if(ObjectFind(0, g_panel_name) < 0 || ObjectFind(0, g_text_name) < 0)
      CreateCountdownObjects();

   if(ObjectFind(0, g_text_name) >= 0)
      ObjectSetString(0, g_text_name, OBJPROP_TEXT, text);

   ChartRedraw(0);
}

//+------------------------------------------------------------------+
//| Update the countdown                                             |
//+------------------------------------------------------------------+
void UpdateCountdown()
{
   string symbol = ChartSymbol(0);
   ENUM_TIMEFRAMES timeframe = (ENUM_TIMEFRAMES)ChartPeriod(0);

   if(symbol == "")
      symbol = _Symbol;
   if(timeframe == PERIOD_CURRENT)
      timeframe = _Period;

   string tf_label = TimeframeLabel(timeframe);

   datetime server_time = 0;
   datetime last_quote_time = 0;
   bool has_fresh_quote = GetBrokerClock(symbol, server_time, last_quote_time);
   if(server_time <= 0)
   {
      SetStatusText(tf_label + "   |   WAITING FOR MARKET DATA");
      return;
   }

   bool has_schedule = false;
   bool session_open = IsInsideQuoteSession(symbol, server_time, has_schedule);

   // A known closed quote session means there is no active candle countdown.
   if(has_schedule && !session_open)
   {
      SetStatusText(tf_label + "   |   MARKET CLOSED");
      return;
   }

   // On holidays or exceptional closures, the broker's weekly session
   // timetable may still say "open". A stale quote suppresses the timer.
   if(!has_fresh_quote)
   {
      SetStatusText(tf_label + "   |   NO LIVE MARKET DATA");
      return;
   }
   datetime bar_open_time = iTime(symbol, timeframe, 0);
   if(bar_open_time <= 0)
   {
      SetStatusText(tf_label + "   |   WAITING FOR CANDLE DATA");
      return;
   }

   int period_seconds = PeriodSeconds(timeframe);
   datetime bar_close_time = CurrentBarCloseTime(timeframe, bar_open_time);
   if(period_seconds <= 0 || bar_close_time <= 0)
   {
      SetStatusText(tf_label + "   |   UNSUPPORTED TIMEFRAME");
      return;
   }

   // If server quote time and candle history are temporarily out of sync,
   // never show a countdown longer than the selected candle period.
   if(server_time < bar_open_time)
   {
      SetStatusText(tf_label + "   |   SYNCING CANDLE DATA");
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
         bar_close_time = CurrentBarCloseTime(timeframe, bar_open_time);
      }

      if(bar_close_time <= 0 || server_time >= bar_close_time)
      {
         SetStatusText(tf_label + "   |   WAITING FOR NEW CANDLE");
         return;
      }
   }

   long remaining_seconds = (long)bar_close_time - (long)server_time;
   if(remaining_seconds < 0)
      remaining_seconds = 0;
   if(remaining_seconds > period_seconds)
   {
      SetStatusText(tf_label + "   |   SYNCING CANDLE DATA");
      return;
   }

   string display_text = StringFormat("%s   |   CLOSES IN   %s",
                                      tf_label,
                                      FormatCountdown(remaining_seconds));
   SetStatusText(display_text);
}

//+------------------------------------------------------------------+
//| Indicator initialization                                         |
//+------------------------------------------------------------------+
int OnInit()
{
   string unique_id = IntegerToString(ChartID()) + "_" + IntegerToString(GetTickCount());
   g_panel_name = "CM_CandleCountdown_Panel_" + unique_id;
   g_text_name  = "CM_CandleCountdown_Text_" + unique_id;

   if(!CreateCountdownObjects())
      return INIT_FAILED;

   if(!EventSetTimer(1))
   {
      Print("ChartMasters: could not start one-second timer. Error: ", GetLastError());
      ObjectDelete(0, g_text_name);
      ObjectDelete(0, g_panel_name);
      return INIT_FAILED;
   }

   UpdateCountdown();
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Indicator deinitialization                                       |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   ObjectDelete(0, g_text_name);
   ObjectDelete(0, g_panel_name);
}

//+------------------------------------------------------------------+
//| Refresh once per second                                          |
//+------------------------------------------------------------------+
void OnTimer()
{
   UpdateCountdown();
}

//+------------------------------------------------------------------+
//| Refresh immediately when chart properties/timeframe change      |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
{
   if(id == CHARTEVENT_CHART_CHANGE)
      UpdateCountdown();
}

//+------------------------------------------------------------------+
//| Required calculation event for a custom indicator                |
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   UpdateCountdown();
   return rates_total;
}
//+------------------------------------------------------------------+
