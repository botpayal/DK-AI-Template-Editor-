DK EDITOR LIVE BACKEND

1) Install Node.js 18+.
2) In this folder run:
   npm install
   npm start
3) Open:
   http://localhost:3000/DK_Editor_User_App_LIVE.html
   http://localhost:3000/DK_Editor_Control_Panel_LIVE.html
4) In Control Panel, set Backend API URL to:
   http://localhost:3000
5) Upload video/photo to template #50 and press SAVE / UPDATE.
6) User App polls every 2.5 seconds, so #50 updates for users without editing the User App.

For real users on the internet, deploy this Node server to a public HTTPS server and put that URL into the Control Panel. Do not expose admin credentials or secret AI keys in the HTML.
