const path = require('path');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

//joining path of directory 
const directoryPath = path.join(__dirname, 'contracts');
var gitRev;

exec('git describe').then((r)=>{
  gitRev = r.stdout.replace(/\s*/g, '');

  fs.readdir(directoryPath, function (err, files) {
    //handling error
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    } 
    //listing all files using forEach

    files.forEach(function (file) {
      if (file.match(/^.*\.sol/g)) {
        var data = fs.readFileSync(directoryPath + '/' + file, 'utf8');
        var versionStr = file.replace(/(^.*)\.sol/g, '$1') + ' ' + gitRev;

        if (err) {
          console.log('Error reading: ', err);
        }

//        var res = data.match(/[ ]*string\s+public\s+codeVersion\s*=\s*\".+\";/g);

        var formatted = data.replace(/[ ]*string\s+public\s+codeVersion\s*=\s*\".+\";/g, " string public codeVersion = \"" + versionStr + "\";");

        fs.writeFile(directoryPath + '/' + file, formatted, 'utf8', function (err) {
          if (err) { console.log(err); }
        });
      }
    });
  });
});