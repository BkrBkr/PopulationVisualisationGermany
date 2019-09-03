# Einleitung 
Deutschland leidet unter einem Phänomen, das langläufig als „Landflucht“ bezeichnet wird. Dabei ziehen immer mehr Menschen vom Land in die Stadt, wie Statistiken belegen (Statista GmbH 2019). Vor allem junge Menschen folgen dem Trend der Urbanisierung und suchen gut bezahlte Arbeitsplätze in den Städten. Ein weiterer Grund für das Schrumpfen der Landbevölkerung ist der demografische Wandel, der zu einer immer älteren Bevölkerung führt. Gerade in Kombination mit dem Auswandern junger Leute aus den Dörfern, führt dieses zu einem starken Bevölkerungsrückgang. (Statistisches Bundesamt (Destatis) 2019a). Zur Veranschaulichung und zur besseren Nachvollziehbarkeit dieses Phänomens ist eine grafische Aufbereitung der Bevölkerungsdaten von Deutschland notwendig. 

# Zielsetzung 
Das Ziel dieses Projekts ist es, die Bevölkerungsverteilung in Deutschland auf einer Landkarte in Form einer Webanwendung zu visualisieren. Primär soll die Visualisierung mit Hilfe einer Heatmap erfolgen, die es ermöglicht Bevölkerungshotspots besonders anschaulich darzustellen. In Verbindung mit einem Slider, soll der schnelle Wechsel zwischen verschiedenen Jahren ermöglicht werden, um so die sich ändernde Verteilung zu veranschaulichen. Neben der Heatmap-Darstellung sollen weitere Darstellungsmöglichkeiten geboten werden, wie die Darstellung der Bevölkerung pro Bundesland mit Einfärbung nach Bevölkerungsdichte und die Darstellung der Bevölkerungsdichte pro Bundesland mit klar zu unterscheidender Einfärbung der Bundesländer. Alle weiteren Anforderungen sind der untenstehenden Auflistung zu entnehmen.

# Installation


## Voraussetzungen
* Docker ist installiert
* NodeJS inklusive NPM ist installiert

## Hinweis
Diese Anleitung ist auf Windows ausgelegt und es wird angenommen, dass das Laufwerk 'D:\' existiert
und eine Festplatte ist.

## Vorgehen
1. Installation & Konfiguration des MapServers
  * Daten kopieren
    * Den 'mapserver'-Ordner aus dem Verzeichnis 'code\Mapserver\' des Projekts ins Verzeichnis 'D:\' kopieren
  * Starten des MapServers in Docker
    * Den Befehl 'docker run --restart=always -d -p 5000:80 --mount type=bind,src="d:/mapserver",target=/etc/mapserver/ camptocamp/mapserver:7.0'
      in der Konsole ausführen.
  * Optional: Die Datei 'bl.gml' kann durch das Speichern des Inhalts der nachfolgenden URL aktualisiert werden
https://sg.geodatenzentrum.de/wfs_vg2500?service=wfs&version=1.1.0&request=GetFeature&outputformat=GML3&typename=vg2500:Bundesland


2. Installation & Konfiguration der Datenbank
  * Starten des Datenbankservers in Docker
    * Mit dem Befehl
      docker run --name gisDB -e POSTGRES_PASSWORD=gis -p 7000:5432 --restart=always -d mdillon/postgis
      wird der Datenbankserver gestartet
  * Datenbank anlegen
    * Die Datenbank 'gis' anlegen (zum Beispiel mit psql) und dabei unbedingt UTF-8 Encoding nutzen
  * Einrichten der Tabellen
    * Import der SQL-Datei aus dem Pfad: code\backend\db\createTable.sql (zum Beispiel mit psql)
    * Alternativer Import über die Datei: code\backend\db\createTable.cmd
    * Datenbank-Passwort: gis
  * Einspielen der Daten
    * Import der Datei aus dem Pfad: code\backend\db\converted\all.sql (zum Beispiel mit psql)
    * Alternativer Import über die Datei: code\backend\db\import.cmd
    * Datenbank-Passwort: gis


3. Installation & Ausführung des NodeJS Backends
* Über eine Konsole in das Verzeichnis 'code\backend\code\' wechseln
* Den Befehl 'npm install' ausführen
* Über 'npm start' die Webanwendung ausführen

4. Aufruf der Weboberfläche
Über die URL 'http://localhost:3000/' kann die Anwendung aufgerufen werden.

# Disclaimer
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.