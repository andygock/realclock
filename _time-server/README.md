# Time server

This is a Node.js Express app that serves a static clock page and provides an API to fetch the current time. The static files are served from the `realclock` directory, and the API is available at `/api/time`.

## Installation

### CORS

Create a `.env` file in the `_time-server/` directory with allowed CORS origins, for example:

    ALLOWED_ORIGINS=http://127.0.0.1:5500,http://time.gock.net,https://time.gock.net

These are the domains that will be allowed to access the time server. You can add or remove domains as needed.

### Install

I use [pnpm](https://pnpm.io/) as my package manager. You can also use npm or yarn instead.

    pnpm install
    node app.js

This will start the server on port `3007` by default. You can change the port by setting the `PORT` environment variable before starting the server.

## Usage

### Static Files

The server serves the static clock page from the `realclock` directory. You can access it by navigating to:

    http://localhost:3007/

### API Endpoint

The server provides an API endpoint at `/api/time` that returns a JSON object with two properties: `milliseconds` and `datetime`.

- `milliseconds` represents the current time in milliseconds past Unix epoch.
- `datetime` represents the current date and time in UTC format with milliseconds included.

Example request:

    curl http://localhost:3007/api/time

Example response:

    {
      "milliseconds": 1648594225793,
      "datetime": "2023-03-29T22:50:25.793Z"
    }

## Configuring clock app

Edit the variable `serverUrl` in `clock.js` to use this server.

## Rate limiting

This server uses the express-rate-limit middleware to rate-limit requests. Each IP address is limited to 30 requests per minute. If a client exceeds this limit, the server will respond with a 429 Too Many Requests status code.

## Using PM2

If using PM2, you can use the following to start the server on port `3007` and name it `time-server`:

    PORT=3007 pm2 start ./app.js --name "time-server"

And to stop or remove it:

    pm2 stop time-server
    pm2 delete time-server

## License

This project is licensed under the MIT License. See the LICENSE file for details.

You can copy the above text into your own `README.md` file and modify it to fit the specifics of your project.
