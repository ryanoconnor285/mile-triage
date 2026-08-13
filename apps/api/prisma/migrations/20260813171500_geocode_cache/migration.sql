-- Cache reverse-geocode lookups so repeated destinations cost one request ever.
CREATE TABLE "GeocodeCache" (
  "id" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeocodeCache_lat_lng_key" ON "GeocodeCache"("lat", "lng");
