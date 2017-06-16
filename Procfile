web: SERVER=true node --optimize_for_size --max_old_space_size=$MEMORY_AVAILABLE -r newrelic build
worker: WORKER=true EXCLUDE_FETCH_JOBS=true node --optimize_for_size --max_old_space_size=$MEMORY_AVAILABLE -r newrelic build
worker-fetch: WORKER=true FETCH_JOBS_ONLY=true node --optimize_for_size --max_old_space_size=$MEMORY_AVAILABLE -r newrelic build
