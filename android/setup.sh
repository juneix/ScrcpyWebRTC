#!/system/bin/sh
cd /data/local/tmp/android
export CLASSPATH=/data/local/tmp/android/scrcpy-server.jar

echo "Stopping existing services..."
pkill -f webrtc-signaling
pkill -f cloudphone-agent
pkill -f scrcpy.Server

echo "Starting Signaling Server..."
chmod +x webrtc-signaling
nohup ./webrtc-signaling -port 8443 -assets ./assets/v1 > signaling.log 2>&1 &
sleep 2

echo "Starting Agent..."
chmod +x cloudphone-agent
setsid nohup ./cloudphone-agent -id local-android -signaling ws://127.0.0.1:8443 -jar ./scrcpy-server.jar > agent.log 2>&1 &

IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')
if [ -z "$IP" ]; then
    IP=$(ifconfig wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | sed 's/addr://')
fi
if [ -z "$IP" ]; then
    IP="<Android-IP>"
fi
echo "Services started. Connect via http://$IP:8443"
