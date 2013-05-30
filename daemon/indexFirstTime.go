package main

import "fmt"
import "labix.org/v2/mgo"

//import "labix.org/v2/mgo/bson"
import "nemaload/hdfwebdaemon"

func main() {
	session, err := mgo.Dial("localhost")
	if err != nil {
		panic(err)
	}
	defer session.Close()
	fileList := hdfwebdaemon.RemoveInvalidFiles(hdfwebdaemon.GetHDFFileList("/mnt/"))
	fmt.Println("Computed file list...")
	for _, path := range fileList {
		hdfwebdaemon.InsertImageIntoDatabase(path, session)
	}
	fmt.Println("Finished inserting images...")
	for _, path := range fileList {
		hdfwebdaemon.ConvertHDF5ToPNG(path, "/var/www/images/", session)
	}
	fmt.Println("Finished script")
}
