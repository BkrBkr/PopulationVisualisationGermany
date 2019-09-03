@echo off
echo BEGIN TRANSACTION; > all.sql
echo \encoding UTF8 >> all.sql
for %%f in (*.sql) do (

	if NOT %%f == all.sql echo \i %%f >> all.sql
)
echo COMMIT TRANSACTION; >> all.sql



