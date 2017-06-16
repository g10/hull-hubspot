web: SERVER=true node --optimize_for_size --max_old_space_size=$MEMORY_AVAILABLE -r newrelic build
worker: WORKER=true node --optimize_for_size --max_old_space_size=$MEMORY_AVAILABLE -r newrelic build
worker-fetch: WORKER=true QUEUE_NAME=fetch node --optimize_for_size --max_old_space_size=$MEMORY_AVAILABLE -r newrelic build
