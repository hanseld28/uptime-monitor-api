# Uptime Monitor API
A simple uptime monitoring application API.

## HTTPS
Sample certificate generated with OpenSSL using the following commands:
```
$ openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem
```