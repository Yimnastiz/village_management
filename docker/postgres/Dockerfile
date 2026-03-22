FROM postgres:16-alpine

ENV POSTGRES_USER=village_user
ENV POSTGRES_PASSWORD=village_password
ENV POSTGRES_DB=village_management
ENV TZ=Asia/Bangkok

EXPOSE 5432

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" || exit 1

