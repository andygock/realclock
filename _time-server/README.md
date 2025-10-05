# Time server

This is a simple Node Express app that returns the current time in milliseconds past Unix epoch and a datetime string in UTC format with milliseconds included. It is also rate-limited to 30 requests per minute.

You '''do not''' need to use this. It's only for users who do not want to use the WorldTimeAPI server.

## Installation

### CORS

Create a `.env` file in the `_time-server/` directory with allowed CORS origins, for example:

    ALLOWED_ORIGINS=http://127.0.0.1:5500,http://time.gock.net,https://time.gock.net

These are the domains that will be allowed to access the time server. You can add or remove domains as needed.

### Install

I use [pnpm](https://pnpm.io/) as my package manager. You can also use npm or yarn instead.

    pnpm install
    node app.js

This will start the server on port `3000` by default. You can change the port by setting the `PORT` environment variable before starting the server.

## Usage

The server has one endpoint at the root path (`/`) that returns a JSON object with two properties: `milliseconds` and `datetime`.

- `milliseconds` represents the current time in milliseconds past Unix epoch.
- `datetime` represents the current date and time in UTC format with milliseconds included.

You can make requests to the server using your web browser or a tool like `curl`.

Example request on port 3007:

    curl http://localhost:3007/

Example response:

```json
{
  "milliseconds": 1648594225793,
  "datetime": "2023-03-29T22:50:25.793Z"
}
```

## Configuring clock app

Edit variable `serverUrl` in `clock.js` to use this server.

## Rate limiting

This server uses the express-rate-limit middleware to rate-limit requests. Each IP address is limited to 30 requests per minute. If a client exceeds this limit, the server will respond with a 429 Too Many Requests status code.

## Using PM2

If using PM2, you can use something to star the server on port `3007` and name it `time-server`:

    PORT=3007 pm2 start ./app.js --name "time-server"

And to stop or remove it

    pm2 stop time-server
    pm2 delete time-server

## License

This project is licensed under the MIT License. See the LICENSE file for details.

You can copy the above text into your own `README.md` file and modify it to fit the specifics of your project.
