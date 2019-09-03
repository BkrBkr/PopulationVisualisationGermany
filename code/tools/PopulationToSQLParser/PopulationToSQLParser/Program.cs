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
using Microsoft.VisualBasic.FileIO;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace PopulationToSQLParser
{
    class Program
    {
        class RefData
        {
            public string name { get; set; }
            public string lat { get; set; }
            public string lng { get; set; }
            public string plz { get; set; }
        }
        /// <summary>
        /// Diese Klasse bereitet die Referenz-Datensätze für die Ermitellung der Koordinaten bei Datensätzen vor 2009 auf. 
        /// </summary>
        /// <returns></returns>
        static Dictionary<string,RefData> ParseRefCoordinates()
        {
            //Zuordnung der Gemeinde erfolgt nach Gemeindenamen
            Dictionary<string, RefData> result = new Dictionary<string, RefData>();
            var srcFile = new System.IO.FileInfo("../../../../../data/population/31122010_Auszug_GV.csv");

            //CSV Parsen
            using (TextFieldParser parser = new TextFieldParser(srcFile.FullName, System.Text.Encoding.GetEncoding(1252)))
            {

                parser.TextFieldType = FieldType.Delimited;
                parser.SetDelimiters(";");
                while (!parser.EndOfData)
                {
                    //Prüfen ob die notwendingen Felder vorhanden sind
                    string[] fields = parser.ReadFields();
                    if (fields.Count() > 15 && !String.IsNullOrWhiteSpace(fields[7]) && !String.IsNullOrWhiteSpace(fields[2]) && !String.IsNullOrWhiteSpace(fields[9]) && !String.IsNullOrWhiteSpace(fields[10]) && !String.IsNullOrWhiteSpace(fields[11]) && !String.IsNullOrWhiteSpace(fields[13])  && !String.IsNullOrWhiteSpace(fields[14]) && !String.IsNullOrWhiteSpace(fields[15]))
                    {
                        //Felder extrahieren
                        string totalPop = fields[9].Replace(" ", "");
                        string lng = fields[14].Replace(" ", "").Replace(",", ".");
                        string lat = fields[15].Replace(" ", "").Replace(",", ".");
                        string bl = fields[2].Replace(" ", "").Replace(",", ".");
                        string mPop = fields[10].Replace(" ", "");
                        string fPop = fields[11].Replace(" ", "");
                        string name = fields[7].Trim().ToLowerInvariant().Replace(".", " ").Replace(",", " ").Replace("(", " ").Replace(")", " ");
                        string plz = fields[13].Replace(" ", "");

                        int p;
                        double p1;
                        int intBl;
                        //Extrahierte Werte auf Gültigkeit überprüfen
                        if (int.TryParse(totalPop, out p) && int.TryParse(mPop, out p) && int.TryParse(fPop, out p) && int.TryParse(plz, out p) && int.TryParse(bl, out intBl) && double.TryParse(lng, out p1) && double.TryParse(lat, out p1))
                        {
                            if(!result.ContainsKey(intBl + name)) { 
                                RefData rd = new RefData();
                                rd.lng = lng;
                                rd.lat = lat;
                                rd.name = intBl + name;
                                rd.plz = plz;
                                result.Add(intBl + name, rd);
                            }
                        }

                    }
                }
            }
            return result;
        }

        /// <summary>
        /// Diese Funktion bestimmt die Jahreszahl aus dem Dateinamen
        /// </summary>
        /// <param name="srcFile"></param>
        /// <returns></returns>
        private static DateTime? ParseFilename(System.IO.FileInfo srcFile)
        {
            var nameParts = srcFile.Name.Split('_');
            DateTime year;
            if (nameParts.Count() != 3 || !DateTime.TryParseExact(nameParts[0],
                       "ddMMyyyy",
                       System.Globalization.CultureInfo.InvariantCulture,
                       System.Globalization.DateTimeStyles.None,
                       out year))
            {

                return null;
            }
            return year;
        }

        /// <summary>
        /// Primäre Verarbeitungsroutine für die zu parsenden CSV-Dateien
        /// </summary>
        /// <param name="args"></param>
        static void Main(string[] args)
        {
            //Referenzdatensätze für Datensätze vor 2009 einlesen
            Dictionary<string, RefData> refDatDict = ParseRefCoordinates();

            //Jede verfügbare CSV-Datei abarbeiten (Pro Jahr eine Datei)
            foreach (var srcFile in new System.IO.DirectoryInfo("../../../../../data/population/").GetFiles("*.csv"))
            {
                //Jahreszahl aus Dateinamen extrahieren
                DateTime? year = ParseFilename(srcFile);
                if (year == null || !year.HasValue)
                {
                    Console.WriteLine("Ungültiger Dateiname");
                    return;
                }
                Dictionary<string, Row> rowDataDict = new Dictionary<string, Row>();

                //CSV parsen
                using (TextFieldParser parser = new TextFieldParser(srcFile.FullName, System.Text.Encoding.GetEncoding(1252)))
                {
                    parser.TextFieldType = FieldType.Delimited;
                    parser.SetDelimiters(";");
                    while (!parser.EndOfData)
                    {
                        //Einzelne Zeile verarbeiten
                        Row rowData = ParseRow(parser, year.Value, refDatDict);

                       
                        if (rowData != null)
                        {
                            if (rowDataDict.ContainsKey(rowData.lat + rowData.lng))
                            {
                                var item = rowDataDict[rowData.lat + rowData.lng];
                                item.totalpop +=rowData.totalpop;
                                item.mPop += rowData.mPop;
                                item.fPop += rowData.fPop;
                            }
                            else { 
                                rowDataDict.Add(rowData.lat + rowData.lng, rowData);
                            }
                            
                        }
                            

                    }
                }
                //Aus geparsten Daten SQL-Kommandos erzeugen
                using (var outfile = new System.IO.StreamWriter(System.IO.Path.Combine(@"../../../../../backend/db/converted/", srcFile.Name + ".sql"), false))
                {
                    outfile.WriteLine("INSERT INTO population(id, coordinates, totalpop, bl, mPop, fPop, dataYear, plz, name) VALUES");
                    string endChar = ",";
                    int i = 0;
                    int count = rowDataDict.Values.Count();

                    foreach (var dataRow in rowDataDict.Values)
                    {
                        i++;
                        if (count == i)
                            endChar = ";";
                        outfile.WriteLine(String.Format("('{0}', ST_GeomFromText('POINT({1} {2})'), {3}, {4}, {5}, {6}, {7}, '{8}', '{9}'){10}", Guid.NewGuid().ToString(), dataRow.lng, dataRow.lat, dataRow.totalpop, dataRow.bl, dataRow.mPop, dataRow.fPop, dataRow.dataYear, dataRow.plz, dataRow.name.Replace("'",""), endChar));
                    }
                    
                }
            }
        }
        private class Row{
            public string id { get; set; }
            public string lng { get; set; }
            public string lat { get; set; }
            public int totalpop { get; set; }
            public string bl { get; set; }
            public int mPop { get; set; }
            public int fPop { get; set; }
            public int dataYear { get; set; }
            public string plz { get; set; }
            public string name { get; set; }

        }

        /// <summary>
        /// Diese Funktion verarbeitet eine einzelne Zeile aus einer CSV-Datei
        /// </summary>
        /// <param name="parser"></param>
        /// <param name="year"></param>
        /// <param name="refDatDict"></param>
        /// <returns></returns>
        private static Row ParseRow(TextFieldParser parser, DateTime year, Dictionary<string, RefData> refDatDict)
        {
            string[] fields = parser.ReadFields();
            if (fields.Count() > 11 && !String.IsNullOrWhiteSpace(fields[2]) && !String.IsNullOrWhiteSpace(fields[7]) && !String.IsNullOrWhiteSpace(fields[9]) && !String.IsNullOrWhiteSpace(fields[10]) && !String.IsNullOrWhiteSpace(fields[11]))
            {

                string totalPop = fields[9].Replace(" ", "");

                string bl = fields[2].Replace(" ", "").Replace(",", ".");
                string mPop = fields[10].Replace(" ", "");
                string fPop = fields[11].Replace(" ", "");
                string name = fields[7].Trim().Replace(".", " ").Replace(",", " ").Replace("(", " ").Replace(")", " ");

                int itotalPop;
                int iMPop;
                int iFPop;
                int p;
                int intBl;
                double p1;
                //Prüfen ob die minimal notwendingen Felder vorhanden sind. (Koordinaten dürfen hier noch fehlen)
                if (int.TryParse(totalPop, out itotalPop) && int.TryParse(mPop, out iMPop) && int.TryParse(fPop, out iFPop) && int.TryParse(bl, out intBl))
                {
                    string lng = "";
                    string lat = "";
                    string plz = "";
                    //Wenn die Koordianten vorhanden sind direkt nutzen
                    if (fields.Count() > 15 && !String.IsNullOrWhiteSpace(fields[13]) && !String.IsNullOrWhiteSpace(fields[14]) && !String.IsNullOrWhiteSpace(fields[15]))
                    {
                        lng = fields[14].Replace(" ", "").Replace(",", ".");
                        lat = fields[15].Replace(" ", "").Replace(",", ".");
                        plz = fields[13].Replace(" ", "");
                    }
                    else  //Wenn keine Koordinaten vorhanden sind Koordinaten aus Referenz-Datensatz anhand des Gemeindenamens extrahieren
                    {

                        string cmpName = intBl + name.ToLowerInvariant();


                        RefData match = null;
                        if (refDatDict.ContainsKey(cmpName))
                        {
                            match = refDatDict[cmpName];
                        }
                        else
                        {
                            //Wenn keine eindeutige Übereinstimmung möglich ist Zuordnung mittels LevenshteinDistance
                            foreach (RefData rd in refDatDict.Values)
                            {
                                if (LevenshteinDistance.Compute(rd.name, cmpName) < 2)
                                {
                                    match = rd;
                                    break;
                                }
                            }
                        }
                       
                        if (match!=null)
                        {
                            lng = match.lng;
                            lat = match.lat;
                            plz = match.plz;

                        }
                        else
                        {
                            return null;
                        }
                    }
                   
                    //Prüfen ob Koordinaten gültig sind und Rückgabe aufbereiten/durchführen
                    if (double.TryParse(lng, out p1) && double.TryParse(lat, out p1) && int.TryParse(plz, out p))
                    {
                        Row r = new Row();
                        r.id= Guid.NewGuid().ToString();
                        r.lng = lng;
                        r.lat= lat;
                        r.totalpop= itotalPop;
                        r.bl= bl;
                        r.mPop = iMPop;
                        r.fPop= iFPop;
                        r.dataYear= year.Year;
                        r.plz = plz;
                        r.name =name;
                        return r;
                    }

                }

            }
            return null;
        }


    }
}
