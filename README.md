# PosturePet
A webcam-powered posture pet that spots forward leaning on-device, uses Gemini to suggest a desk adjustment, and shows whether you lean less afterward.

## Run the focus session locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000) in Chrome. The browser downloads the MediaPipe model and its runtime when you start a session. Camera frames and pose landmarks stay on the device.

## Chrome checkpoint

1. Enable **Demo mode**, click **Start session**, and allow the camera.
2. With your face and shoulders in frame, click **Calibrate** and sit comfortably until the pet says **Looking good**.
3. Type and move normally. Then lean toward the screen for about five seconds until the pet says **Leaning forward**. Sit back to clear the nudge.
4. Step out of frame, switch tabs, then return. Tracking should resume when you are back in frame. Click **Stop session** and check that Chrome releases the camera.

If the nudge is hard to trigger, open **Tracking details** and note the lean score while typing normally and while leaning forward. The starting threshold is 112% of your calibrated shoulder width. Camera position and framing affect the reading.

## Desk adjustment checkpoint

Open **Help me adjust** after calibrating. The **Sample tip** works without an API key. Keep working as usual until the before measurement is ready, then try the tip and click **I tried this**. Repeat the same task for the after measurement and select how the adjustment felt.

Each window uses 30 seconds of valid tracking. Hidden tabs, out-of-frame time, and gaps in camera samples do not count. The comparison stays in the current session and resets when you recalibrate or stop.
