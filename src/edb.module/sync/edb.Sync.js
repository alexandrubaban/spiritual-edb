/**
 * [description]
 * @return {[type]} [description]
 */
edb.Sync = ( function () {

	/**
	 * [ChangeHandler description]
	 * @type {Object}
	 */
	var ChangeHandler = {

		onchange : function ( changes ) {
			var dispatch = {};
			var syncdone = [];
			changes.forEach ( function ( c ) {
				this._maybechange ( c, c.object, dispatch, syncdone );
			}, this );
			gui.Object.each ( dispatch, function ( id, c ) {
				gui.Broadcast.dispatch ( null, id, c );
			});
			syncdone.forEach ( function ( type ) {
				delete type.$willsync;
			});
		},

		_maybechange : function ( change, type, dispatch, syncdone ) {
			var sourceid = type.$instanceid;
			var targetid = type.$originalid || sourceid;
			if ( type.$willsync ) {
				syncdone.push ( type );
			} else {
				var changes = dispatch [ targetid ] = ( dispatch [ targetid ] || []);
				this._dochange ( change, changes, sourceid );
			}	
		},

		_dochange : function ( change, changes, sourceid ) {
			switch ( change.type ) {
				case edb.ObjectChange.TYPE_UPDATE :
					changes.push ( new edb.ObjectSync ( change, sourceid ));
					break;
				case edb.ArrayChange.TYPE_SPLICE :
					changes.push ( new edb.ArraySync ( change, sourceid ));
					break;
			}
		}
	};


	return { // Public .............................................

		/**
		 * Hm.
		 */
		$synchronize : function ( type ) {
			new edb.Crawler ().crawl ( type, {
				ontype : function ( t ) {
					var id = t.$originalid || t.$instanceid;
					gui.Broadcast.add ( id, new edb.SyncJohn ( t ));
					t.addObserver ( ChangeHandler );
				}
			});
		}
	};

}());