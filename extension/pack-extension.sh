#!/bin/bash

ext_name=ubiquity
myfilename="$ext_name-$(date +%s).oex"
#rm *.*~;
rm $ext_name*.oex 2>/dev/null
# TODO: minify JS
ext_dir=".build-$ext_name-$(date +%s)"
rm -rf $ext_dir 2>/dev/null
mkdir -p $ext_dir
mkdir -p $ext_dir/includes
cp -p config.xml $ext_dir

#cp -p $ext_name.js $ext_dir/background.js
#cp -p $ext_name.user.js $ext_dir/includes/$ext_name.js

cp -p $ext_name.js $ext_dir/includes/$ext_name.js

cp -p index.html $ext_dir/index.html
cp -p README.ext $ext_dir/README

cd $ext_dir; zip -r ../${myfilename} *

