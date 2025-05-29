# webrtc-signaling-server
A simple extendable WebRTC signaling server implementation

This implmentation targets applications that need to share real time data over a data channel, but can be extended for media data exchange.

Designed for use alongside a web-server like nginx acting as a reverse proxy. With the proxy, you can serve your client and websocket server **from the same origin**. For example:<br/>
`https://mywebrtcapp.site` Client served<br/>
`wss://mywebrtcapp.site/ws` WebSocket server

Good way to save yourself time and effort configuring cross origin policies as would be the case directly accessing a seperate port.

 Sample configuration for a reverse proxy via nginx:
 ```
# /etc/nginx/conf.d/mywebrtcapp.conf

server {
    listen      443 ssl;
    server_name mywebrtcapp.site; 

    ssl_certificate     /path/to/ssl/certfile.pem;
    ssl_certificate_key /path/to/ssl/privkeyfile.pem;

    location / {
        root      /path/to/frontend/root/directory; #/srv/http/mywebrtcapp.site/dist
        index     index.html;
        try_files $uri $uri/ /index.html;
    }

    location /ws {
        proxy_pass         http://mywebrtcapp.site:7001; # dont add the trailing slash here, 
        proxy_http_version 1.1;                          # debugged 301 redirects for an hour
        proxy_set_header   Upgrade $http_upgrade;        # before figuring out a trailing slash was the culprit
        proxy_set_header   Connection "Upgrade";
        proxy_set_header   Host $host;
        proxy_read_timeout 60s;
    }
}
```

## Running the server
Prerequisite: NodeJS installed

To run simply execute `npm i` (only the first time running) then `npm start`.
