vcl 4.1;
 
backend default {
    .host = "nginx-media";
    .port = "80";
}
 
sub vcl_recv {
    # Only cache GET and HEAD requests
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);
    }
 
    # Cache video stream segments and playlists
    if (req.url ~ "\.(ts|m4s|mp4|m3u8)$") {
        unset req.http.Cookie; # Cookies prevent caching
        return (hash);
    }
}
 
sub vcl_backend_response {
    # Force video segments to stay in cache for 1 hour
    if (bereq.url ~ "\.(ts|m4s)$") {
        unset beresp.http.set-cookie;
        set beresp.ttl = 1h;
    }
}

sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
    } else {
        set resp.http.X-Cache = "MISS";
    }
}
