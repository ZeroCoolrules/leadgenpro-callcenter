FROM php:8.2-apache

# PDO MySQL driver required by api/config.php
RUN docker-php-ext-install pdo pdo_mysql

# Allow .htaccess (mod_rewrite) to take effect
RUN a2enmod rewrite \
    && sed -ri -e 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

WORKDIR /var/www/html
COPY . .

# Installer/build artifacts that shouldn't ship in the image
RUN rm -f install.php README-INSTALL.txt

# Render (and most PaaS hosts) tell the container which port to listen on via
# $PORT; Apache's own config files don't support shell-style ${VAR:-default}
# expansion, so resolve it at container start instead.
ENV PORT=80
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["apache2-foreground"]
