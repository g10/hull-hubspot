# Setup

If you want your own instance: [![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy?template=https://github.com/hull-ships/hull-hubspot)

---

### Using :

[See Readme here](https://dashboard.hullapp.io/readme?url=https://hull-hubspot.herokuapp.com)

### Developing :

- Fork
- Install
- Start Redis instance
- Copy .env.sample -> .env and set CLIENT_ID, CLIENT_SECRET, REDIS_URL

```sh
npm install
npm start
npm run start:dev # for autoreloading after changes
```

#### Docker based

If you want Docker based development after setting `.env` file:

```sh
docker-compose run install
docker-compose up -d redis
docker-compose up dev # with autoreloading enabled
```

### Testing :
- create developer account at https://developers.hubspot.com/docs/overview
- from developer's account dashboard you should obtain CLIENT_ID and CLIENT_SECRET and paste it to .env file

### Logs :
  
  Specific logs messages for Hubspot Connector :
    - `fetch.users.progress` - when fetching users from hubspot
    - `fetch.users.finished` - when fetching users finished  
