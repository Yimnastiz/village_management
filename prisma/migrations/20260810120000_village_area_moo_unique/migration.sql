-- One real village may be opened once per province, district, subdistrict and moo.
-- NULL values remain possible for legacy records; creation is validated in the app.
CREATE UNIQUE INDEX "village_area_moo_key"
ON "Village"("province", "district", "subdistrict", "moo");
