# Time server

This is a simple Node Express app that returns the current time in milliseconds past Unix epoch and a datetime string in UTC format with milliseconds included. It is also rate-limited to 30 requests per minute.

You '''do not''' need to use this. It's only for users who do not want to use the WorldTimeAPI server.

## Installation

    npm install
    npm start

This will start the server on port 3000 by default. You can change the port by setting the `PORT` environment variable before starting the server.

## Usage

The server has one endpoint at the root path (`/`) that returns a JSON object with two properties: `milliseconds` and `datetime`.

- `milliseconds` represents the current time in milliseconds past Unix epoch.
- `datetime` represents the current date and time in UTC format with milliseconds included.

You can make requests to the server using your web browser or a tool like `curl`.

Example request on port 3000:

    curl http://localhost:3000/

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

If using PM2, you can use something to star the server on port 3030 and name it `datetime-server`:

    PORT=3030 pm2 start ./app.js --name "datetime-server"

And to stop or remove it

    pm2 stop datetime-server
    pm2 delete datetime-server

## License

This project is licensed under the MIT License. See the LICENSE file for details.

You can copy the above text into your own `README.md` file and modify it to fit the specifics of your project.
