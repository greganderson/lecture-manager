export namespace main {
	
	export class FileEntry {
	    number: number;
	    name: string;
	    fullName: string;
	
	    static createFrom(source: any = {}) {
	        return new FileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.number = source["number"];
	        this.name = source["name"];
	        this.fullName = source["fullName"];
	    }
	}

}

