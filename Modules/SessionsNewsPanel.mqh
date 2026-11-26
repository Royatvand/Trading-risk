// SESSIONS & NEWS PANEL
// Displays global trading sessions and the existing MQL5 economic-calendar cache.

input group "=== Sessions & News Panel ==="
input int  InpSN_X = 410;                 // Panel X position
input int  InpSN_Y = 25;                  // Panel Y position
input bool InpSN_ShowHeadlines = true;    // Show GDELT headlines section

#define SN_PREFIX "CM_SN_"
#define SN_WIDTH 365
#define SN_HEIGHT 510
#define SN_NEWS_ROWS 4
#define SN_HEADLINE_ROWS 2
bool g_sn_minimized=false;

// Keep the title bar and its toggle visible while the panel is collapsed.
void SN_ApplyMinimize()
{
   for(int i=ObjectsTotal(0)-1;i>=0;i--)
   {
      string name=ObjectName(0,i);
      if(StringFind(name,SN_PREFIX)!=0) continue;
      bool keep=(name==SN_PREFIX+"bg" || name==SN_PREFIX+"header" ||
                 name==SN_PREFIX+"line" || name==SN_PREFIX+"title" ||
                 name==SN_PREFIX+"btn_min");
      ObjectSetInteger(0,name,OBJPROP_TIMEFRAMES,
                       (!g_sn_minimized || keep)? OBJ_ALL_PERIODS:OBJ_NO_PERIODS);
   }
   if(ObjectFind(0,SN_PREFIX+"bg")>=0)
      ObjectSetInteger(0,SN_PREFIX+"bg",OBJPROP_YSIZE,g_sn_minimized?44:SN_HEIGHT);
   if(ObjectFind(0,SN_PREFIX+"btn_min")>=0)
      ObjectSetString(0,SN_PREFIX+"btn_min",OBJPROP_TEXT,g_sn_minimized?"+":"–");
   ChartRedraw(0);
}


//--- UI helpers
void SN_Rect(string id,int x,int y,int w,int h,color bg,color border)
{
   string n=SN_PREFIX+id;
   if(ObjectFind(0,n)<0 && !ObjectCreate(0,n,OBJ_RECTANGLE_LABEL,0,0,0))
   {
      Print("Sessions & News: cannot create ",n,". Error: ",GetLastError());
      return;
   }
   ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,n,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,n,OBJPROP_YSIZE,h);
   ObjectSetInteger(0,n,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,n,OBJPROP_COLOR,border);
   ObjectSetInteger(0,n,OBJPROP_BORDER_TYPE,BORDER_FLAT);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_BACK,false);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,2);
}

void SN_Label(string id,int x,int y,string value,color clr,int size=8,
              string font="Tahoma",ENUM_ANCHOR_POINT anchor=ANCHOR_LEFT_UPPER)
{
   string n=SN_PREFIX+id;
   if(ObjectFind(0,n)<0 && !ObjectCreate(0,n,OBJ_LABEL,0,0,0))
   {
      Print("Sessions & News: cannot create ",n,". Error: ",GetLastError());
      return;
   }
   ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,n,OBJPROP_ANCHOR,anchor);
   ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y);
   ObjectSetString(0,n,OBJPROP_TEXT,value);
   ObjectSetString(0,n,OBJPROP_FONT,font);
   ObjectSetInteger(0,n,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,n,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_BACK,false);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,3);
}

void SN_SetLabel(string id,string value,color clr)
{
   string n=SN_PREFIX+id;
   if(ObjectFind(0,n)<0) return;
   ObjectSetString(0,n,OBJPROP_TEXT,value);
   ObjectSetInteger(0,n,OBJPROP_COLOR,clr);
}

void SN_Button(string id,int x,int y,int w,int h,string value)
{
   string n=SN_PREFIX+id;
   if(ObjectFind(0,n)<0 && !ObjectCreate(0,n,OBJ_BUTTON,0,0,0))
   {
      Print("Sessions & News: cannot create button ",n,". Error: ",GetLastError());
      return;
   }
   ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,n,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,n,OBJPROP_YSIZE,h);
   ObjectSetString(0,n,OBJPROP_TEXT,value);
   ObjectSetString(0,n,OBJPROP_FONT,"Tahoma");
   ObjectSetInteger(0,n,OBJPROP_FONTSIZE,8);
   ObjectSetInteger(0,n,OBJPROP_COLOR,C_TEXT);
   ObjectSetInteger(0,n,OBJPROP_BGCOLOR,C_BTN);
   ObjectSetInteger(0,n,OBJPROP_BORDER_COLOR,C_BORDER);
   ObjectSetInteger(0,n,OBJPROP_STATE,false);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,5);
}

//--- UTC calendar helpers for daylight-saving transitions
datetime SN_MakeUTC(int year,int month,int day,int hour,int minute=0)
{
   MqlDateTime p;
   p.year=year; p.mon=month; p.day=day;
   p.hour=hour; p.min=minute; p.sec=0;
   return StructToTime(p);
}

int SN_Weekday(int year,int month,int day)
{
   MqlDateTime p;
   datetime d=SN_MakeUTC(year,month,day,12,0);
   if(!TimeToStruct(d,p)) return -1;
   return p.day_of_week; // Sunday = 0
}

int SN_FirstSunday(int year,int month)
{
   for(int day=1;day<=7;day++)
      if(SN_Weekday(year,month,day)==0) return day;
   return 1;
}

int SN_NthSunday(int year,int month,int nth)
{
   return SN_FirstSunday(year,month)+(nth-1)*7;
}

int SN_DaysInMonth(int year,int month)
{
   if(month==2)
      return ((year%4==0 && year%100!=0) || year%400==0) ? 29 : 28;
   if(month==4 || month==6 || month==9 || month==11) return 30;
   return 31;
}

int SN_LastSunday(int year,int month)
{
   for(int day=SN_DaysInMonth(year,month);day>=SN_DaysInMonth(year,month)-6;day--)
      if(SN_Weekday(year,month,day)==0) return day;
   return SN_DaysInMonth(year,month)-6;
}

bool SN_IsLondonDST(datetime utc_now)
{
   MqlDateTime p;
   if(!TimeToStruct(utc_now,p)) return false;
   datetime start=SN_MakeUTC(p.year,3,SN_LastSunday(p.year,3),1);
   datetime finish=SN_MakeUTC(p.year,10,SN_LastSunday(p.year,10),1);
   return (utc_now>=start && utc_now<finish);
}

bool SN_IsNewYorkDST(datetime utc_now)
{
   MqlDateTime p;
   if(!TimeToStruct(utc_now,p)) return false;
   datetime start=SN_MakeUTC(p.year,3,SN_NthSunday(p.year,3,2),7);
   datetime finish=SN_MakeUTC(p.year,11,SN_FirstSunday(p.year,11),6);
   return (utc_now>=start && utc_now<finish);
}

bool SN_IsSydneyDST(datetime utc_now)
{
   MqlDateTime p;
   if(!TimeToStruct(utc_now,p)) return false;
   datetime start=SN_MakeUTC(p.year,10,SN_FirstSunday(p.year,10),0)-8*3600;
   datetime finish=SN_MakeUTC(p.year,4,SN_FirstSunday(p.year,4),0)-8*3600;
   return (utc_now>=start || utc_now<finish);
}

string SN_FormatDuration(int seconds)
{
   if(seconds<0) seconds=0;
   int h=seconds/3600;
   int m=(seconds%3600)/60;
   int s=seconds%60;
   if(h>0) return StringFormat("%02d:%02d:%02d",h,m,s);
   return StringFormat("%02d:%02d",m,s);
}

string SN_SessionStatus(datetime utc_now,int start_hour,int end_hour)
{
   MqlDateTime p;
   if(!TimeToStruct(utc_now,p)) return "زمان نامشخص";
   int now_seconds=p.hour*3600+p.min*60+p.sec;
   int start_seconds=start_hour*3600;
   int end_seconds=end_hour*3600;
   bool open=false;
   if(start_seconds<end_seconds)
      open=(now_seconds>=start_seconds && now_seconds<end_seconds);
   else
      open=(now_seconds>=start_seconds || now_seconds<end_seconds);

   int remaining=0;
   if(open)
      remaining=(end_seconds-now_seconds+86400)%86400;
   else
      remaining=(start_seconds-now_seconds+86400)%86400;

   if(!open && remaining==0) remaining=86400;
   if(open)
      return "فعال  |  پایان "+SN_FormatDuration(remaining);
   return "غیرفعال  |  شروع "+SN_FormatDuration(remaining);
}

string SN_TranslateNewsTitle(string source_title)
{
   string s=source_title;
   string lower=s;
   StringToLower(lower);

   if(StringFind(lower,"nonfarm payroll")>=0 || StringFind(lower,"non-farm payroll")>=0 ||
      StringFind(lower,"nonfarm employment")>=0) return "اشتغال بخش غیرکشاورزی آمریکا (NFP)";
   if(StringFind(lower,"core cpi")>=0) return "شاخص قیمت مصرف‌کننده هسته‌ای";
   if(StringFind(lower,"cpi")>=0 || StringFind(lower,"consumer price index")>=0)
      return "شاخص قیمت مصرف‌کننده";
   if(StringFind(lower,"core pce")>=0) return "شاخص هسته‌ای مخارج مصرف شخصی (PCE)";
   if(StringFind(lower,"pce price")>=0) return "شاخص مخارج مصرف شخصی (PCE)";
   if(StringFind(lower,"ppi")>=0 || StringFind(lower,"producer price index")>=0)
      return "شاخص قیمت تولیدکننده";
   if(StringFind(lower,"unemployment rate")>=0) return "نرخ بیکاری";
   if(StringFind(lower,"initial jobless claims")>=0 || StringFind(lower,"unemployment claims")>=0)
      return "درخواست اولیه بیمه بیکاری";
   if(StringFind(lower,"retail sales")>=0) return "فروش خرده‌فروشی";
   if(StringFind(lower,"gross domestic product")>=0 || StringFind(lower,"gdp")>=0)
      return "تولید ناخالص داخلی (GDP)";
   if(StringFind(lower,"interest rate decision")>=0 || StringFind(lower,"rate decision")>=0 ||
      StringFind(lower,"federal funds rate")>=0) return "تصمیم نرخ بهره";
   if(StringFind(lower,"fomc press conference")>=0) return "نشست خبری کمیته بازار آزاد فدرال";
   if(StringFind(lower,"fomc minutes")>=0) return "صورت‌جلسه کمیته بازار آزاد فدرال";
   if(StringFind(lower,"fomc statement")>=0) return "بیانیه کمیته بازار آزاد فدرال";
   if(StringFind(lower,"manufacturing pmi")>=0) return "شاخص مدیران خرید بخش تولید";
   if(StringFind(lower,"services pmi")>=0) return "شاخص مدیران خرید بخش خدمات";
   if(StringFind(lower,"pmi")>=0 || StringFind(lower,"purchasing managers")>=0)
      return "شاخص مدیران خرید (PMI)";
   if(StringFind(lower,"consumer confidence")>=0) return "اعتماد مصرف‌کننده";
   if(StringFind(lower,"trade balance")>=0) return "تراز تجاری";
   if(StringFind(lower,"housing starts")>=0) return "آغاز ساخت‌وساز مسکن";
   if(StringFind(lower,"durable goods")>=0) return "سفارش کالاهای بادوام";
   if(StringFind(lower,"industrial production")>=0) return "تولید صنعتی";
   if(StringFind(lower,"retail sales")>=0) return "فروش خرده‌فروشی";
   if(StringFind(lower,"central bank")>=0 && StringFind(lower,"speech")>=0)
      return "سخنرانی مقام بانک مرکزی";
   return source_title; // Unknown names stay in English rather than being mistranslated.
}

string SN_ImportancePersian(int importance)
{
   if(importance==(int)CALENDAR_IMPORTANCE_HIGH) return "زیاد";
   if(importance==(int)CALENDAR_IMPORTANCE_MODERATE) return "متوسط";
   if(importance==(int)CALENDAR_IMPORTANCE_LOW) return "کم";
   return "نامشخص";
}

string SN_FormatCalendarValue(bool available,double value,int digits)
{
   if(!available) return "-";
   int precision=MathMax(0,MathMin(8,digits));
   return DoubleToString(value,precision);
}

void SN_CreatePanel()
{
   int x=InpSN_X, y=InpSN_Y, pad=13;
   SN_Rect("bg",x,y,SN_WIDTH,SN_HEIGHT,C_BG,C_BORDER);
   SN_Rect("header",x,y,SN_WIDTH,42,C_HEADER,C_HEADER);
   SN_Rect("line",x,y+42,SN_WIDTH,2,C_ACCENT,C_ACCENT);
   SN_Label("title",x+pad,y+11,"سشن‌ها و اخبار اقتصادی",C_TEXT,11,"Tahoma");
   SN_Button("btn_news_refresh",x+SN_WIDTH-122,y+9,78,24,"تازه‌سازی خبر");
   SN_Button("btn_min",x+SN_WIDTH-38,y+9,26,24,"–");

   SN_Label("sessions_title",x+pad,y+55,"وضعیت سشن‌های معاملاتی",C_ACCENT,9,"Tahoma");
   SN_Rect("candle_chip",x+SN_WIDTH-160,y+50,147,24,C_CARD,C_BORDER);
   SN_Label("candle_timer",x+SN_WIDTH-154,y+55,"کندل: در حال محاسبه...",C_ACCENT,8,"Tahoma");
   string session_names[4]={"سیدنی","توکیو","لندن","نیویورک"};
   for(int i=0;i<4;i++)
   {
      int row_y=y+79+i*22;
      SN_Label("session_name_"+IntegerToString(i),x+pad,row_y,session_names[i],C_TEXT,9,"Tahoma");
      SN_Label("session_state_"+IntegerToString(i),x+108,row_y,"در حال محاسبه...",C_MUTED,8,"Tahoma");
   }

   SN_Rect("divider",x+pad,y+169,SN_WIDTH-2*pad,1,C_BORDER,C_BORDER);
   SN_Label("calendar_title",x+pad,y+180,"تقویم اقتصادی",C_ACCENT,9,"Tahoma");
   SN_Button("btn_headline_refresh",x+SN_WIDTH-91,y+175,78,23,"تیترهای جدید");
   SN_Label("calendar_status",x+pad,y+202,"در حال دریافت اطلاعات تقویم...",C_MUTED,8,"Tahoma");
   SN_Rect("news_card",x+pad-4,y+222,SN_WIDTH-2*pad+8,184,C_CARD,C_BORDER);
   for(int i=0;i<SN_NEWS_ROWS;i++)
   {
      int row_y=y+229+i*42;
      SN_Label("news_meta_"+IntegerToString(i),x+pad+4,row_y,"-",C_WARN,8,"Tahoma");
      SN_Label("news_title_"+IntegerToString(i),x+pad+4,row_y+14,"-",C_TEXT,9,"Tahoma");
      SN_Label("news_values_"+IntegerToString(i),x+pad+4,row_y+27,"-",C_MUTED,7,"Tahoma");
      if(i<SN_NEWS_ROWS-1)
         SN_Rect("news_sep_"+IntegerToString(i),x+pad+4,row_y+40,SN_WIDTH-2*pad-8,1,C_BORDER,C_BORDER);
   }

   if(InpSN_ShowHeadlines)
   {
      SN_Label("headlines_title",x+pad,y+414,"تیترهای جهانی",C_ACCENT,9,"Tahoma");
      SN_Label("headlines_status",x+pad,y+434,"در حال دریافت تیترها...",C_MUTED,7,"Tahoma");
      for(int i=0;i<SN_HEADLINE_ROWS;i++)
      {
         int row_y=y+453+i*23;
         SN_Label("headline_title_"+IntegerToString(i),x+pad+4,row_y,"-",C_TEXT,8,"Tahoma");
         SN_Label("headline_meta_"+IntegerToString(i),x+pad+4,row_y+13,"-",C_MUTED,7,"Tahoma");
      }
   }
}

void SN_UpdatePanel()
{
   datetime utc_now=TimeGMT();
   if(utc_now<=0) utc_now=TimeCurrent();

   bool sydney_dst=SN_IsSydneyDST(utc_now);
   bool london_dst=SN_IsLondonDST(utc_now);
   bool newyork_dst=SN_IsNewYorkDST(utc_now);

   string state=SN_SessionStatus(utc_now,sydney_dst?21:22,sydney_dst?6:7);
   SN_SetLabel("session_state_0",state,StringFind(state,"فعال")==0? C_ACCENT:C_MUTED);
   state=SN_SessionStatus(utc_now,0,9);
   SN_SetLabel("session_state_1",state,StringFind(state,"فعال")==0? C_ACCENT:C_MUTED);
   state=SN_SessionStatus(utc_now,london_dst?7:8,london_dst?16:17);
   SN_SetLabel("session_state_2",state,StringFind(state,"فعال")==0? C_ACCENT:C_MUTED);
   state=SN_SessionStatus(utc_now,newyork_dst?12:13,newyork_dst?21:22);
   SN_SetLabel("session_state_3",state,StringFind(state,"فعال")==0? C_ACCENT:C_MUTED);

   string calendar_status;
   if(!gNewsDataOK) calendar_status="تقویم اقتصادی در دسترس نیست؛ اتصال و پشتیبانی بروکر را بررسی کن";
   else if(gNewsCount<=0) calendar_status="رویدادی برای نمایش در این نماد ثبت نشده";
   else calendar_status=IntegerToString(gNewsCount)+" رویداد | زمان انتشار بر اساس سرور بروکر";
   if(gNewsBlock) calendar_status+=" | فیلتر خبری: مسدود";
   SN_SetLabel("calendar_status",calendar_status,gNewsBlock? C_SELL:(gNewsDataOK? C_MUTED:C_WARN));

   for(int i=0;i<SN_NEWS_ROWS;i++)
   {
      string meta="-";
      string title=(i==0 && !gNewsDataOK)? "داده تقویم اقتصادی دریافت نشد":"رویدادی ثبت نشده";
      string values="-";
      color clr=C_MUTED;
      if(i<gNewsCount)
      {
         meta=gNews[i].currency+" | اهمیت "+SN_ImportancePersian(gNews[i].importance)+
              " | "+TimeToString(gNews[i].time,TIME_DATE|TIME_MINUTES);
         title=SN_TranslateNewsTitle(gNews[i].title);
         if(StringLen(title)>48) title=StringSubstr(title,0,45)+"...";
         values="واقعی: "+SN_FormatCalendarValue(gNews[i].hasActual,gNews[i].actual,gNews[i].digits)+
                "  پیش‌بینی: "+SN_FormatCalendarValue(gNews[i].hasForecast,gNews[i].forecast,gNews[i].digits)+
                "  قبلی: "+SN_FormatCalendarValue(gNews[i].hasPrevious,gNews[i].previous,gNews[i].digits);
         clr=NewsImportanceColor(gNews[i].importance);
      }
      SN_SetLabel("news_meta_"+IntegerToString(i),meta,clr);
      SN_SetLabel("news_title_"+IntegerToString(i),title,i<gNewsCount? C_TEXT:C_MUTED);
      SN_SetLabel("news_values_"+IntegerToString(i),values,i<gNewsCount? C_MUTED:C_MUTED);
   }

   if(InpSN_ShowHeadlines)
   {
      string hs=!gHeadlineDataOK? "تیترهای زنده در دسترس نیستند":
                (gHeadlineCount>0? IntegerToString(gHeadlineCount)+" تیتر | ۲۴ ساعت اخیر":"تیتر مرتبطی پیدا نشد");
      SN_SetLabel("headlines_status",hs,gHeadlineDataOK? C_MUTED:C_WARN);
      for(int i=0;i<SN_HEADLINE_ROWS;i++)
      {
         string title=i<gHeadlineCount? gHeadlines[i].title:"تیتر خبری موجود نیست";
         string meta=i<gHeadlineCount? gHeadlines[i].source:"-";
         if(StringLen(title)>47) title=StringSubstr(title,0,44)+"...";
         if(StringLen(meta)>54) meta=StringSubstr(meta,0,51)+"...";
         SN_SetLabel("headline_title_"+IntegerToString(i),title,i<gHeadlineCount? C_TEXT:C_MUTED);
         SN_SetLabel("headline_meta_"+IntegerToString(i),meta,C_MUTED);
      }
   }
}

bool SN_Init()
{
   SN_CreatePanel();
   SN_UpdatePanel();
   SN_ApplyMinimize();
   return true;
}

void SN_Deinit()
{
   ObjectsDeleteAll(0,SN_PREFIX);
   ChartRedraw(0);
}

void SN_ChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
   if(id!=CHARTEVENT_OBJECT_CLICK) return;
   if(sparam==SN_PREFIX+"btn_min")
   {
      g_sn_minimized=!g_sn_minimized;
      SN_ApplyMinimize();
      ObjectSetInteger(0,sparam,OBJPROP_STATE,false);
   }
   else if(sparam==SN_PREFIX+"btn_news_refresh")
   {
      ObjectSetInteger(0,sparam,OBJPROP_STATE,false);
      RefreshNews();
      SN_UpdatePanel();
   }
   else if(sparam==SN_PREFIX+"btn_headline_refresh")
   {
      ObjectSetInteger(0,sparam,OBJPROP_STATE,false);
      RefreshHeadlines(true);
      SN_UpdatePanel();
   }
}
