FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The frontend static files will be copied from the frontend service
# This is handled via volumes in docker-compose

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
