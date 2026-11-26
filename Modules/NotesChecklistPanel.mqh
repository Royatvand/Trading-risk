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
int  g_nc_x=0,g_nc_y=0;
bool g_nc_dragging=false;
int  g_nc_drag_dx=0,g_nc_drag_dy=0;
long g_nc_prev_scroll=1;

// Keep the header accessible while hiding checklist and note controls.
string NC_RTLText(const string value)
{
   bool rtl=false;
   for(int i=0;i<StringLen(value);i++)
   {
      ushort ch=(ushort)StringGetCharacter(value,i);
      if((ch>=0x0590 && ch<=0x08FF) || (ch>=0xFB1D && ch<=0xFEFC))
      {
         rtl=true;
         break;
      }
   }
   if(!rtl) return value;
   string mark=ShortToString(0x200F);
   return mark+value+mark;
}

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
   ObjectSetString(0,n,OBJPROP_TEXT,NC_RTLText(value));
   ObjectSetString(0,n,OBJPROP_FONT,"Tahoma");
   ObjectSetInteger(0,n,OBJPROP_FONTSIZE,size);
   ObjectSetInteger(0,n,OBJPROP_COLOR,clr);
   ObjectSetInteger(0,n,OBJPROP_ANCHOR,ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,false);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_BACK,false);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,3);
}

void NC_SetLabel(string id,string value,color clr)
{
   string n=NC_PREFIX+id;
   if(ObjectFind(0,n)<0) return;
   ObjectSetString(0,n,OBJPROP_TEXT,NC_RTLText(value));
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
   ObjectSetString(0,n,OBJPROP_TEXT,NC_RTLText(value));
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
   ObjectSetInteger(0,n,OBJPROP_ALIGN,ALIGN_RIGHT);
   ObjectSetInteger(0,n,OBJPROP_READONLY,false);
   ObjectSetInteger(0,n,OBJPROP_SELECTABLE,true);
   ObjectSetInteger(0,n,OBJPROP_HIDDEN,true);
   ObjectSetInteger(0,n,OBJPROP_ZORDER,4);
}

void NC_CreatePanel()
{
   int x=g_nc_x,y=g_nc_y,pad=13;
   NC_Rect("bg",x,y,NC_WIDTH,NC_HEIGHT,C_BG,C_BORDER);
   NC_Rect("header",x,y,NC_WIDTH,42,C_HEADER,C_HEADER);
   NC_Rect("line",x,y+42,NC_WIDTH,2,C_ACCENT,C_ACCENT);
   NC_Label("title",x+NC_WIDTH-pad,y+11,"یادداشت و چک‌لیست معامله",C_TEXT,11);
   NC_Button("btn_min",x+pad,y+9,26,24,"–",C_BTN,C_TEXT);

   NC_Label("note_title",x+NC_WIDTH-pad,y+55,"یادداشت سریع",C_ACCENT,9);
   NC_Edit("note_edit",x+pad+94,y+76,NC_WIDTH-pad-(pad+94),27,g_nc_note);
   NC_Button("btn_save",x+pad,y+76,84,27,"ذخیره",C_BTN,C_TEXT);

   NC_Label("check_title",x+NC_WIDTH-pad,y+119,"چک‌لیست پیش از ورود",C_ACCENT,9);
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
      NC_Button("check_"+IntegerToString(i),x+NC_WIDTH-pad-27,row_y,27,22,"□",C_BTN,C_TEXT);
      NC_Label("item_"+IntegerToString(i),x+NC_WIDTH-pad-37,row_y+5,items[i],C_TEXT,8);
   }

   NC_Rect("footer_line",x+pad,y+323,NC_WIDTH-2*pad,1,C_BORDER,C_BORDER);
   NC_Label("progress",x+NC_WIDTH-pad,y+337,"۰ از ۶ مورد تکمیل شده",C_MUTED,8);
   NC_Button("btn_reset",x+pad,y+332,94,25,"بازنشانی",C_BTN,C_TEXT);
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

void NC_SetMinimized(const bool minimized)
{
   if(g_nc_minimized==minimized) return;
   if(minimized && !g_nc_minimized)
   {
      string edit=NC_PREFIX+"note_edit";
      if(ObjectFind(0,edit)>=0) g_nc_note=ObjectGetString(0,edit,OBJPROP_TEXT);
      NC_Save();
   }
   g_nc_minimized=minimized;
   NC_ApplyMinimize();
   if(!minimized) NC_UpdatePanel();
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


string nc_PositionKey(const string axis)
{
   string symbol=_Symbol;
   StringReplace(symbol,".","_");
   StringReplace(symbol,"/","_");
   return "CM_NOTES_"+IntegerToString((int)AccountInfoInteger(ACCOUNT_LOGIN))+"_"+
          symbol+"_"+IntegerToString((int)_Period)+"_"+axis;
}

void nc_LoadPosition()
{
   g_nc_x=InpNC_X;
   g_nc_y=InpNC_Y;
   string kx=nc_PositionKey("X");
   string ky=nc_PositionKey("Y");
   if(GlobalVariableCheck(kx)) g_nc_x=(int)GlobalVariableGet(kx);
   if(GlobalVariableCheck(ky)) g_nc_y=(int)GlobalVariableGet(ky);
}

void nc_SavePosition()
{
   GlobalVariableSet(nc_PositionKey("X"),g_nc_x);
   GlobalVariableSet(nc_PositionKey("Y"),g_nc_y);
   GlobalVariablesFlush();
}

void nc_MovePanel(const int x,const int y)
{
   int dx=x-g_nc_x, dy=y-g_nc_y;
   if(dx==0 && dy==0) return;
   for(int i=ObjectsTotal(0)-1;i>=0;i--)
   {
      string name=ObjectName(0,i);
      if(StringFind(name,NC_PREFIX)!=0) continue;
      ObjectSetInteger(0,name,OBJPROP_XDISTANCE,
                       (int)ObjectGetInteger(0,name,OBJPROP_XDISTANCE)+dx);
      ObjectSetInteger(0,name,OBJPROP_YDISTANCE,
                       (int)ObjectGetInteger(0,name,OBJPROP_YDISTANCE)+dy);
   }
   g_nc_x=x;
   g_nc_y=y;
   ChartRedraw(0);
}

void nc_HandleDrag(const int id,const long &lparam,
                         const double &dparam,const string &sparam)
{
   if(id!=CHARTEVENT_MOUSE_MOVE) return;
   int mouse=(int)StringToInteger(sparam);
   bool down=((mouse & 1)!=0);
   int mx=(int)lparam, my=(int)dparam;

   if(!g_nc_dragging && down &&
      mx>=g_nc_x+110 && mx<=g_nc_x+NC_WIDTH-8 &&
      my>=g_nc_y && my<=g_nc_y+42)
   {
      g_nc_dragging=true;
      g_nc_drag_dx=mx-g_nc_x;
      g_nc_drag_dy=my-g_nc_y;
      g_nc_prev_scroll=ChartGetInteger(0,CHART_MOUSE_SCROLL);
      ChartSetInteger(0,CHART_MOUSE_SCROLL,false);
   }

   if(!g_nc_dragging) return;

   if(down)
   {
      int chartW=(int)ChartGetInteger(0,CHART_WIDTH_IN_PIXELS);
      int chartH=(int)ChartGetInteger(0,CHART_HEIGHT_IN_PIXELS);
      int nx=MathMax(0,MathMin(MathMax(0,chartW-NC_WIDTH),mx-g_nc_drag_dx));
      int ny=MathMax(0,MathMin(MathMax(0,chartH-44),my-g_nc_drag_dy));
      nc_MovePanel(nx,ny);
   }
   else
   {
      g_nc_dragging=false;
      ChartSetInteger(0,CHART_MOUSE_SCROLL,g_nc_prev_scroll!=0);
      nc_SavePosition();
   }
}

bool NC_Init()
{
   NC_Load();
   NC_LoadPosition();
   NC_CreatePanel();
   NC_UpdatePanel();
   NC_ApplyMinimize();
   return true;
}

void NC_Deinit()
{
   NC_SavePosition();
   string edit=NC_PREFIX+"note_edit";
   if(ObjectFind(0,edit)>=0) g_nc_note=ObjectGetString(0,edit,OBJPROP_TEXT);
   NC_Save();
   ObjectsDeleteAll(0,NC_PREFIX);
   ChartRedraw(0);
}

void NC_ChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam)
{
   if(id==CHARTEVENT_MOUSE_MOVE)
   {
      NC_HandleDrag(id,lparam,dparam,sparam);
      return;
   }
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
