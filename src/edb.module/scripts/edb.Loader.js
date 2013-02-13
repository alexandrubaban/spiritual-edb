/**
 * EDB template loader.
 * @extends {edb.GenericLoader}
 */
edb.Loader = edb.GenericLoader.extend ( "edb.Loader", {
	
	/**
	 * Handle loaded script source; externally loaded file may contain multiple scripts.
	 * @param {String} text
	 * @param {gui.URL} url
	 * @param {function} callback
	 * @param @optional {object} thisp
	 */
	onload : function ( text, url, callback, thisp ) {
		if ( url.external ) {
			text = this._extract ( text, url );
		}
		this._super.onload ( text, url, callback, thisp );	
	},
	
	/**
	 * EDBML templates are loaded as HTML documents with one or more script 
	 * tags. The requested script should have an @id to match the URL #hash.  
	 * If no hash was given, we return the source code of first script found.
	 * @param {String} text HTML with one or more script tags
	 * @param {gui.URL} url
	 * @returns {String} Template source code
	 */
	_extract : function ( text, url ) {
		// TODO: cache this element for repeated lookups
		var temp = this._document.createElement ( "div" );
		temp.innerHTML = text;
		var script = temp.querySelector ( url.hash || "script" );
		var source = null;
		if ( script ) {
			switch ( script.type ) {
				case "text/edbml" :
					source = script.textContent;
					break;
				default :
					console.error ( "Bad script type: " + ( script.type || "[no script type]" ));
					break;
			}
		} else {
			console.error ( "No script found: " + url.location );
		}
		return source;
	}
});