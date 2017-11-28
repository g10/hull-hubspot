# Changelog

## v0.3.9
- fix overwrite param for outgoing traffic

## v0.3.8
- upgrade oauth strategy to v2.0
- adds status endpoint
- adds hull_summary message to "*.user.error" log messages

## v0.3.7
- fix segment parsing
- upgrade hull-node to 0.11.8 -> new firehose
- handle requestExtract errors
- update logging convention

## v0.3.6
- upgrade hull-node to 0.11.3
- fix batch handler
- fetch and sync users in one job instead of queuing everything as a separate job
- add a separete worker for `fetchAll` operations

## v0.3.5
- hotfix and make sure that the fields mapping configuration is correct

## v0.3.4
- remove hours, minutes and seconds from datetime in case the hubspot property has type == "date"

## v0.3.3
- switch back to es2015 babel preset and ignore specs which had class super call issue

## v0.3.2
- improves outgoing users error logging and fixes success message

## v0.3.1
- rewrites calls in sync operation to avoid putting to much work and data into queue
- log but resolve user updates batches which include invalid email
- changes the babeljs preset to match nodejs version
- adds first end-to-end testing

## v0.3.0
- upgrade to hull-node@0.11.0
- rewrite main files structure
- adds basic testing

## v0.2.6
- adds `fetchStopAt` param to the fetch operation, so every job will fetch users updated since previous call and till the time the job was called, then it stops - it should prevent looping. For the reliability there is a new env var called `HUBSPOT_FETCH_OVERLAP_SEC` to control number of seconds each job will go ahead of it's stop time to make sure no user will be skipped in between jobs
- adjusts eslint config
- fixes logging levels

## v0.2.5
- make sure the process exit after an `uncaughtException`

## v0.2.4
- [maintenance] update dependencies
- [UI] design updates
- [tooling] include `npm run ngrok` command

## v0.2.3
- [hotfix] treat the incoming field as an array only when it's enumeration checkbox, other enumeration - select, radio is treated as a signle value field

## v0.2.2
- [bugfix] move `ship:update` handler to background job so it doesn't interfere
with refresh token operation (which triggers the update event) 

## v0.2.1
- [bugfix] handle the datetime field type
- [maintenance] add automatic queue cleaning
- [maintenance] add more logging about token problems

## v0.2.0
- [feature] enable custom outgoing attributes mapping (can map both to new and existing fields on Hubspot). In case of new field a prefixed `hull_` property is created.
- [feature] load list of properties to settings select inputs
- [feature] cast arrays for incoming data to save it as array in Hull
- [bugfix] fix handling of different values, until now trait with value `false` won't be sent
- [maintenance] logging level support
- [maintenance] introduce modules from utils library
- [maintenance] improve logging and metrics

## v0.1.0
- setIfNull for `first_name` and `last_name`
- join outgoing arrays with ";"
