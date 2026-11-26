// NOTES & CHECKLIST PANEL
// Persists the quick note and checklist locally in the MT5 Common Files folder.

input group "=== Notes & Checklist Panel ==="
input int InpNC_X = 780;                 // Panel X position
input int InpNC_Y = 25;                  // Panel Y position

#define NC_PREFIX "CM_NC_"
#define NC_WIDTH 350
#define NC_HEIGHT 372
#define NC_ITEMS 6

string g_nc_note="";
bool g_nc_checked[NC_ITEMS];
bool g_nc_minimized=false;

// Keep the header accessible while hiding checklist and note controls.
void NC_ApplyMinimize()
{
   for(int i=ObjectsTotal(0)-1;i>=0;i--)
   {
      string name=ObjectName(0,i);
      if(StringFind(name,NC_PREFIX)!=0) continue;
      bool keep=(name==NC_PREFIX+"bg" || name==NC_PREFIX+"header" ||
                 name==NC_PREFIX+"line" || name==NC_PREFIX+"title" ||
                 name==NC_PREFIX+"btn_min");
      ObjectSetInteger(0,name,OBJPROP_TIMEFRAMES,
                       (!g_nc_minimized || keep)? OBJ_ALL_PERIODS:OBJ_NO_PERIODS);
   }
   if(ObjectFind(0,NC_PREFIX+"bg")>=0)
      ObjectSetInteger(0,NC_PREFIX+"bg",OBJPROP_YSIZE,g_nc_minimized?44:NC_HEIGHT);
   if(ObjectFind(0,NC_PREFIX+"btn_min")>=0)
      ObjectSetString(0,NC_PREFIX+"btn_min",OBJPROP_TEXT,g_nc_minimized?"+":"–");
   ChartRedraw(0);
}


string NC_FileName()
{
   string sym=_Symbol;
   StringReplace(sym,"/","_");
   StringReplace(sym,"\\","_");
   return "ChartMasters_TradingDashboard_"+IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN))+"_"+sym+".txt";
}

void NC_Rect(string id,int x,int y,int w,int h,color bg,color border)
{
   string n=NC_PREFIX+id;
   if(ObjectFind(0,n)<0 && !ObjectCreate(0,n,OBJ_RECTANGLE_LABEL,0,0,0))
   {
      Print("Notes & Checklist: cannot create ",n,". Error: ",GetLastError());
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

void NC_Label(string id,int x,int y,string value,color clr,int size=8)
{
   string n=NC_PREFIX+id;
   if(ObjectFind(0,n)<0 && !ObjectCreate(0,n,OBJ_LABEL,0,0,0))
   {
      Print("Notes & Checklist: cannot create ",n,". Error: ",GetLastError());
      return;
   }
   ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y);
   ObjectSetString(0,n,OBJPROP_TEXT,value);
   ObjectSetString(0,n,OBJPROP_FONT,"Tahoma");
   ObjectSetInteger(0,n,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,n,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_BACK,false);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,3);
}

void NC_SetLabel(string id,string value,color clr)
{
   string n=NC_PREFIX+id;
   if(ObjectFind(0,n)<0) return;
   ObjectSetString(0,n,OBJPROP_TEXT,value);
   ObjectSetInteger(0,n,OBJPROP_COLOR,clr);
}

void NC_Button(string id,int x,int y,int w,int h,string value,color bg,color fg)
{
   string n=NC_PREFIX+id;
   if(ObjectFind(0,n)<0 && !ObjectCreate(0,n,OBJ_BUTTON,0,0,0))
   {
      Print("Notes & Checklist: cannot create button ",n,". Error: ",GetLastError());
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
   ObjectSetInteger(0,n,OBJPROP_COLOR,fg);
   ObjectSetInteger(0,n,OBJPROP_BGCOLOR,bg);
   ObjectSetInteger(0,n,OBJPROP_BORDER_COLOR,C_BORDER);
   ObjectSetInteger(0,n,OBJPROP_STATE,false);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,5);
}

void NC_Edit(string id,int x,int y,int w,int h,string value)
{
   string n=NC_PREFIX+id;
   if(ObjectFind(0,n)<0 && !ObjectCreate(0,n,OBJ_EDIT,0,0,0))
   {
      Print("Notes & Checklist: cannot create edit ",n,". Error: ",GetLastError());
      return;
   }
   ObjectSetInteger(0,n,OBJPROP_CORNER,CORNER_LEFT_UPPER);
   ObjectSetInteger(0,n,OBJPROP_XDISTANCE,x);
   ObjectSetInteger(0,n,OBJPROP_YDISTANCE,y);
   ObjectSetInteger(0,n,OBJPROP_XSIZE,w);
   ObjectSetInteger(0,n,OBJPROP_YSIZE,h);
   ObjectSetString(0,n,OBJPROP_TEXT,value);
   ObjectSetString(0,n,OBJPROP_FONT,"Tahoma");
   ObjectSetInteger(0,n,OBJPROP_FONTSIZE,9);
   ObjectSetInteger(0,n,OBJPROP_COLOR,C_TEXT);
   ObjectSetInteger(0,n,OBJPROP_BGCOLOR,C_BAR_BG);
   ObjectSetInteger(0,n,OBJPROP_BORDER_COLOR,C_BORDER);
   ObjectSetInteger(0,n,OBJPROP_ALIGN,ALIGN_LEFT);
   ObjectSetInteger(0,n,OBJPROP_READONLY,false);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,true);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,4);
}

void NC_CreatePanel()
{
   int x=InpNC_X,y=InpNC_Y,pad=13;
   NC_Rect("bg",x,y,NC_WIDTH,NC_HEIGHT,C_BG,C_BORDER);
   NC_Rect("header",x,y,NC_WIDTH,42,C_HEADER,C_HEADER);
   NC_Rect("line",x,y+42,NC_WIDTH,2,C_ACCENT,C_ACCENT);
   NC_Label("title",x+pad,y+11,"یادداشت و چک‌لیست معامله",C_TEXT,11);
   NC_Button("btn_min",x+NC_WIDTH-38,y+9,26,24,"–",C_BTN,C_TEXT);

   NC_Label("note_title",x+pad,y+55,"یادداشت سریع",C_ACCENT,9);
   NC_Edit("note_edit",x+pad,y+76,230,27,g_nc_note);
   NC_Button("btn_save",x+252,y+76,84,27,"ذخیره",C_BTN,C_TEXT);

   NC_Label("check_title",x+pad,y+119,"چک‌لیست پیش از ورود",C_ACCENT,9);
   string items[NC_ITEMS]={
      "ساختار بازار و جهت معامله مشخص است",
      "نقدینگی یا ناحیه ورود تأیید شده",
      "تریگر ورود طبق پلن صادر شده",
      "حد ضرر پشت نقطه ابطال قرار دارد",
      "حجم معامله با ریسک مجاز هماهنگ است",
      "اخبار و سشن بررسی شده‌اند"
   };
   for(int i=0;i<NC_ITEMS;i++)
   {
      int row_y=y+148+i*28;
      NC_Button("check_"+IntegerToString(i),x+pad,row_y,27,22,"□",C_BTN,C_TEXT);
      NC_Label("item_"+IntegerToString(i),x+pad+37,row_y+5,items[i],C_TEXT,8);
   }

   NC_Rect("footer_line",x+pad,y+323,NC_WIDTH-2*pad,1,C_BORDER,C_BORDER);
   NC_Label("progress",x+pad,y+337,"۰ از ۶ مورد تکمیل شده",C_MUTED,8);
   NC_Button("btn_reset",x+NC_WIDTH-107,y+332,94,25,"بازنشانی",C_BTN,C_TEXT);
}

void NC_Load()
{
   ArrayInitialize(g_nc_checked,false);
   g_nc_note="";
   int h=FileOpen(NC_FileName(),FILE_READ|FILE_TXT|FILE_UNICODE|FILE_COMMON);
   if(h==INVALID_HANDLE) return;

   if(!FileIsEnding(h)) g_nc_note=FileReadString(h);
   for(int i=0;i<NC_ITEMS;i++)
   {
      if(FileIsEnding(h)) break;
      g_nc_checked[i]=(FileReadString(h)=="1");
   }
   FileClose(h);
}

bool NC_Save()
{
   int h=FileOpen(NC_FileName(),FILE_WRITE|FILE_TXT|FILE_UNICODE|FILE_COMMON);
   if(h==INVALID_HANDLE)
   {
      Print("Notes & Checklist: cannot save file. Error: ",GetLastError());
      return false;
   }
   FileWrite(h,g_nc_note);
   for(int i=0;i<NC_ITEMS;i++)
      FileWrite(h,g_nc_checked[i]? "1":"0");
   FileClose(h);
   return true;
}

void NC_UpdatePanel()
{
   int done=0;
   for(int i=0;i<NC_ITEMS;i++)
   {
      if(g_nc_checked[i]) done++;
      string button=NC_PREFIX+"check_"+IntegerToString(i);
      if(ObjectFind(0,button)>=0)
      {
         ObjectSetString(0,button,OBJPROP_TEXT,g_nc_checked[i]? "✓":"□");
         ObjectSetInteger(0,button,OBJPROP_BGCOLOR,g_nc_checked[i]? C_ACCENT:C_BTN);
         ObjectSetInteger(0,button,OBJPROP_COLOR,g_nc_checked[i]? C_BG:C_TEXT);
      }
   }
   NC_SetLabel("progress",IntegerToString(done)+" از "+IntegerToString(NC_ITEMS)+" مورد تکمیل شده",
               done==NC_ITEMS? C_ACCENT:C_MUTED);
}

bool NC_Init()
{
   NC_Load();
   NC_CreatePanel();
   NC_UpdatePanel();
   NC_ApplyMinimize();
   return true;
}

void NC_Deinit()
{
   string edit=NC_PREFIX+"note_edit";
   if(ObjectFind(0,edit)>=0) g_nc_note=ObjectGetString(0,edit,OBJPROP_TEXT);
   NC_Save();
   ObjectsDeleteAll(0,NC_PREFIX);
   ChartRedraw(0);
}

void NC_ChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
   if(id==CHARTEVENT_OBJECT_CLICK)
   {
      if(sparam==NC_PREFIX+"btn_min")
      {
         if(!g_nc_minimized)
         {
            string edit=NC_PREFIX+"note_edit";
            if(ObjectFind(0,edit)>=0) g_nc_note=ObjectGetString(0,edit,OBJPROP_TEXT);
            NC_Save();
         }
         g_nc_minimized=!g_nc_minimized;
         NC_ApplyMinimize();
         if(!g_nc_minimized) NC_UpdatePanel();
         ObjectSetInteger(0,sparam,OBJPROP_STATE,false);
         return;
      }
      if(sparam==NC_PREFIX+"btn_save")
      {
         g_nc_note=ObjectGetString(0,NC_PREFIX+"note_edit",OBJPROP_TEXT);
         NC_Save();
         NC_SetLabel("progress","یادداشت ذخیره شد",C_ACCENT);
         ObjectSetInteger(0,sparam,OBJPROP_STATE,false);
         return;
      }
      if(sparam==NC_PREFIX+"btn_reset")
      {
         for(int i=0;i<NC_ITEMS;i++) g_nc_checked[i]=false;
         NC_Save();
         NC_UpdatePanel();
         ObjectSetInteger(0,sparam,OBJPROP_STATE,false);
         return;
      }
      if(StringFind(sparam,NC_PREFIX+"check_")==0)
      {
         int index=(int)StringToInteger(StringSubstr(sparam,StringLen(NC_PREFIX)+6));
         if(index>=0 && index<NC_ITEMS)
         {
            g_nc_checked[index]=!g_nc_checked[index];
            NC_Save();
            NC_UpdatePanel();
         }
         ObjectSetInteger(0,sparam,OBJPROP_STATE,false);
      }
   }
   else if(id==CHARTEVENT_OBJECT_ENDEDIT && sparam==NC_PREFIX+"note_edit")
   {
      g_nc_note=ObjectGetString(0,sparam,OBJPROP_TEXT);
      NC_Save();
      NC_SetLabel("progress","یادداشت ذخیره شد",C_ACCENT);
   }
}
