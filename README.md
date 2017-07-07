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
  warn : 
    - incoming.user.warning - logged when getting hull traits
    - sendUsersJob works best for under 100 users at once - logged when trying to send more than 100 users
    - Error in ContactProperty sync - logged when encountered some problems in contact property
  info :
  
  error :
    - requestExtract.error - logged when extracting request for segments update/delete
    - Hubspot batch error - logged when encountered some problems with sending users batch
    - sendUsers.error - general error logged when send users operation will fail
    - shipUpdateJob.err - general error logged when setting up ship
    - non recoverable error - log that indicates some unknown problems
    - checkToken: Ship private settings lack token information - connector private settings missing token information
    - Error in refreshAccessToken - logged when encountered some problems while refreshing hubspot access token
    - getContact gets maximum of 100 contacts at once - logged when contacts list from hubspot exceeds 100 objects
    
  
  
