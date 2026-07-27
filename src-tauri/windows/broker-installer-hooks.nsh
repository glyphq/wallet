!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\glyph" "" "URL:com.qubic.glyph protocol"
  WriteRegStr SHCTX "Software\Classes\glyph" "URL Protocol" ""
  WriteRegStr SHCTX "Software\Classes\glyph\DefaultIcon" "" "$INSTDIR\glyph-link-broker.exe,0"
  WriteRegStr SHCTX "Software\Classes\glyph\shell\open\command" "" '$\"$INSTDIR\glyph-link-broker.exe$\" $\"%1$\"'
!macroend
