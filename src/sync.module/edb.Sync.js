/**
 * Synchronization studio.
 * @using {gui.Arguments.confirmed}
 */
edb.Sync = ( function using ( confirmed ) {

	var globals = {};

	/**
	 * Setup type for synchronization.
	 * @param {edb.Type} type 
	 * @param {boolean} syncto
	 * @param {boolean} syncas
	 * @param {boolean} global
	 */
	function setup ( type, syncto, syncas, global ) {
		var id = type.$originalid || type.$instanceid;
		if ( syncto ) {
			var broadcast = edb.Sync.BROADCAST + id;
			var adds = global ? "addGlobal" : "add";
			gui.Broadcast [ adds ] ( broadcast, 
				new edb.SyncJohn ( type )
			);
		}
		if ( syncas ) {
			type.addObserver ( edb.Sync );
			if ( global ) {
				globals [ id ] = true;
			}
		}
	}

	/**
	 * Relay all changes from monitored source to 
	 * synchronized targets via broadcast message.
	 * @param {Array<edb.Change>} changes
	 */
	function onchange ( changes ) {
		var dispatch = {};
		var syncdone = [];
		changes.forEach ( function ( c ) {
			maybechange ( c, c.object, dispatch, syncdone );
		});
		gui.Object.each ( dispatch, function ( id, syncs ) {
			// console.log ( JSON.stringify ( syncs, null, 4 ));
			var method = globals [ id ] ? "dispatchGlobal" : "dispatch";
			gui.Broadcast [ method ] ( null, edb.Sync.BROADCAST + id, syncs );
		});
		syncdone.forEach ( function ( type ) {
			delete type.$willsync;
		});
	}

	function maybechange ( change, type, dispatch, syncdone ) {
		var sourceid = type.$instanceid;
		var targetid = type.$originalid || sourceid;
		if ( type.$willsync ) {
			syncdone.push ( type );
		} else {
			var changes = dispatch [ targetid ] = ( dispatch [ targetid ] || []);
			changes.push ( getchange ( change, sourceid ));
		}
	}

	function getchange ( change, sourceid ) {
		switch ( change.type ) {
			case edb.ObjectChange.TYPE_UPDATE :
				var neu = change.newValue;
				var old = change.oldValue;
				if ( edb.Type.is ( old )) {
					console.log ( change.name + "\n" + old + "\n" + neu );
				}
				return new edb.ObjectSync ( change, sourceid );
			case edb.ArrayChange.TYPE_SPLICE :
				return new edb.ArraySync ( change, sourceid );
		}
	}


	return { // Public .............................................

		BROADCAST : "edb-synchronize-",
		
		$SYNC_AS : 0,
		$SYNC_TO : 1,
		$SYNC : 2,

		/**
		 * @param {edb.Type} type
		 * @param {number} ways
		 * @param {boolean} global
		 */
		sync : confirmed ( "object", "number", "(boolean)" ) ( 
			function ( type, ways, global ) {
				var syncas = ways === 2 || ways === 0;
				var syncto = ways === 2 || ways === 1;
				new edb.Crawler ().crawl ( type, {
					ontype : function ( t ) {
						setup ( t, syncto, syncas, global );
					}
				});
				return type;
			}
		),

		/**
		 * Handle changes.
		 * @implements {IChangeHandler}
		 */
		onchange : function ( changes ) {
			onchange ( changes );
		}
	};

}( gui.Arguments.confirmed ));