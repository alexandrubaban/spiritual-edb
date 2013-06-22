/**
 * The function loader will fetch a function string from an external 
 * document or scan the local document for functions in SCRIPT tags.
 * @extends {gui.FileLoader}
 */
edb.Loader = gui.FileLoader.extend ({

	/**
	 * Mapping script element attributes to be used as compiler directives. 
	 * @type {Map<String,object>}
	 */
	directives : null,

	/**
	 * Load script source as text/plain.
	 * @overwrites {gui.FileLoader#load}
	 * @param {String} src
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	load : function ( src, callback, thisp ) {
		var url = new gui.URL ( this._document, src );
		if ( this._cache.has ( url.location )) {
			this._cached ( url, callback, thisp );
		} else if ( url.external ) {				
			this._request ( url, callback, thisp );
		} else if ( url.hash ) {
			this._lookup ( url, callback, thisp );
		} else {
			console.error ( "Now what?" );
		}
	},

	/**
	 * Handle loaded script source. Externally loaded file may contain multiple scripts.
	 * @overwrites {gui.FileLoader#onload}
	 * @param {String} text
	 * @param {gui.URL} url
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	onload : function ( text, url, callback, thisp ) {
		if ( url.external ) {
			text = this._extract ( text, url );
		}
		callback.call ( thisp, text, this.directives, url );
		this.directives = null;
	},
	

	// PRIVATES ........................................................................
	
	/**
	 * Lookup script in document DOM (as opposed to HTTP request).
	 * @param {gui.URL} url
	 * @param {Map<String,String>} cache
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	_lookup : function ( url, callback, thisp ) {
		var script = this._document.querySelector ( url.hash );
		this.directives = gui.AttPlugin.getmap ( script );
		this.onload ( script.textContent, url, callback, thisp );
	},

	/**
	 * Templates are loaded as HTML documents with one or more script tags. 
	 * The requested script should have an @id to match the URL #hash.  
	 * If no hash was given, we return the source code of first script found.
	 * @param {String} text HTML with one or more script tags
	 * TODO: cache this stuff for repeated lookups!
	 * @param {gui.URL} url
	 * @returns {String} Template source code
	 */
	_extract : function ( text, url ) {
		var doc = gui.HTMLParser.parseToDocument ( text ); // @TODO: cache this
		//alert ( doc.baseURI || doc.URL );
		var script = doc.querySelector ( url.hash || "script" );
		if ( script ) {	
			this.directives = gui.AttPlugin.getmap ( script );
			return script.textContent;
		} else {
			console.error ( "No such script: " + url.location + url.hash || "" );
		}
	}


});