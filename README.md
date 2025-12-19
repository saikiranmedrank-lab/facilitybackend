Backend setup (Postgres + Express)

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET`.
2. Install dependencies:

   npm install

3. Configure MongoDB:

   - If you don't have a MongoDB instance, create one (Atlas or local) and obtain the connection string.
   - Copy `.env.example` to `.env` and set `MONGO_URI` and `JWT_SECRET`.

   Troubleshooting connection errors:
   - If you see "buffering timed out" or a Mongoose timeout, it means the server cannot reach your MongoDB instance.
   - For MongoDB Atlas: add your IP address to the Network Access whitelist (or use 0.0.0.0/0 for quick testing).
   - Verify `MONGO_URI` format: `mongodb+srv://USER:PASSWORD@cluster0.mongodb.net/mydb?retryWrites=true&w=majority` or `mongodb://USER:PASSWORD@host:port/mydb`.
   - Try connecting from your machine using `mongo` shell or a tiny node script to validate credentials and reachability.
   - Check firewall, VPC, or corporate network rules that may block outbound access to the DB host/port.

4. Start server:

   npm run dev

Auth endpoints:
- POST /api/auth/register  { email, password, name }
- POST /api/auth/login     { email, password }

Front-end login posts to `/api/auth/login` by default.
