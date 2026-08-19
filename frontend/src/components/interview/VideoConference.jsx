import { useEffect, useRef } from 'react';

const JITSI_DOMAIN = import.meta.env.VITE_JITSI_DOMAIN || 'meet.jit.si';

export default function VideoConference({ roomName, displayName }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    function init() {
      if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;

      apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName: `kemsap-codelive-${roomName}`,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: { displayName },
        configOverwrite: { prejoinPageEnabled: false, disableDeepLinking: true },
        interfaceConfigOverwrite: { TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'desktop', 'chat', 'tileview', 'hangup',
        ] },
      });
    }

    if (window.JitsiMeetExternalAPI) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = `https://${JITSI_DOMAIN}/external_api.js`;
      script.async = true;
      script.onload = init;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
    };
  }, [roomName, displayName]);

  return <div ref={containerRef} className="h-full w-full bg-black" />;
}
