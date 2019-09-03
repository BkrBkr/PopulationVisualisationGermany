/*
 *	 PopulationVisualisationGermany - The web GIS application "PopulationVisualisationGermany" visualises the changes in the distribution of the population in Germany over time.
 *   Copyright (C) 2019 Björn Kremer und Thomas Rozanski
 *
 *   This program is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS population;
DROP TABLE IF EXISTS bl;
 
CREATE TABLE bl(
   id integer PRIMARY KEY,
   name VARCHAR (255) NOT NULL UNIQUE,
   center geography(POINT,4326) NOT NULL UNIQUE
);

CREATE TABLE population(
   id VARCHAR (36) PRIMARY KEY,
   coordinates geography(POINT,4326) NOT NULL,
   totalPop integer NOT NULL,
   mPop integer NOT NULL,
   fPop integer NOT NULL,
   dataYear integer NOT NULL,
   bl integer NOT NULL references bl(id),
   plz VARCHAR (5) NOT NULL,
   name VARCHAR (255) NOT NULL,
   UNIQUE(coordinates, dataYear)
);

INSERT INTO bl (id, name, center) VALUES 
(1,'Schleswig-Holstein',ST_GeomFromText('POINT(9.590859173304214 54.20822110662827)')),
(2,'Hamburg',ST_GeomFromText('POINT(9.989069282006145 53.55987970273382)')),
(3,'Niedersachsen',ST_GeomFromText('POINT(9.295682079812334 52.731297607374486)')),
(4,'Bremen',ST_GeomFromText('POINT(8.79155944329093 53.11050485104978)')),
(5,'Nordrhein-Westfalen',ST_GeomFromText('POINT(7.692926644872547 51.648692900301455)')),
(6,'Hessen',ST_GeomFromText('POINT(9.003593008020022 50.524436263475415)')),
(7,'Rheinland-Pfalz',ST_GeomFromText('POINT(7.312917660106273 49.95335903923115)')),
(8,'Baden-Württemberg',ST_GeomFromText('POINT(9.001608660954442 48.662587493070305)')),
(9,'Bayern',ST_GeomFromText('POINT(11.406100395854537 48.917407631761236)')),
(10,'Saarland',ST_GeomFromText('POINT(6.880979836646381 49.37622301184283)')),
(11,'Berlin',ST_GeomFromText('POINT(13.424410143821033 52.50577374028688)')),
(12,'Brandenburg',ST_GeomFromText('POINT(13.627541650398241 52.1717783422361)')),
(13,'Mecklenburg-Vorpommern',ST_GeomFromText('POINT(12.502763018157873 53.90042623903625)')),
(14,'Sachsen',ST_GeomFromText('POINT(13.45502575224636 50.927341445462645)')),
(15,'Sachsen-Anhalt',ST_GeomFromText('POINT(11.874017813725239 51.99006479297004)')),
(16,'Thüringen',ST_GeomFromText('POINT(11.265520364472554 50.92665045818618)'));