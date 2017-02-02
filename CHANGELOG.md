# Changelog

## 0.2.0
- [feature] enable custom outgoing attributes mapping (can map both to new and existing fields on Hubspot). In case of new field a prefixed `hull_` property is created.
- [feature] load list of properties to settings select inputs
- [feature] cast arrays for incoming data to save it as array in Hull
- [bugfix] fix handling of different values, until now trait with value `false` won't be sent
- [maintenance] logging level support
- [maintenance] introduce modules from utils library
- [maintenance] improve logging and metrics

## 0.1.0
- setIfNull for `first_name` and `last_name`
- join outgoing arrays with ";"
