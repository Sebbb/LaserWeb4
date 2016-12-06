// Copyright 2014, 2016 Todd Fleming
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
// 
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

'use strict';

import { getLaserCutGcodeFromOp } from './cam-gcode-laser-cut'
import { getMillGcodeFromOp } from './cam-gcode-mill'
import { rawPathsToClipperPaths, union } from './mesh';

function matchColor(filterColor, color) {
    if (!filterColor)
        return true;
    if (!color)
        return false;
    return filterColor[0] == color[0] && filterColor[1] == color[1] && filterColor[2] == color[2] && filterColor[3] == color[3];
}

export function getGcode(settings, documents, operations, documentCacheHolder, showAlert) {
    "use strict";

    var gcode = settings.gcodeStart;

    for (var opIndex = 0; opIndex < operations.length; ++opIndex) {
        var op = operations[opIndex];

        let geometry = [];
        let openGeometry = [];
        let tabGeometry = [];
        let docsWithImages = [];
        function examineDocTree(isTab, id) {
            let doc = documents.find(d => d.id === id);
            if (doc.rawPaths) {
                if (isTab) {
                    tabGeometry = union(tabGeometry, rawPathsToClipperPaths(doc.rawPaths, doc.scale[0], doc.scale[1], doc.translate[0], doc.translate[1]));
                } else if (matchColor(op.filterFillColor, doc.fillColor) && matchColor(op.filterStrokeColor, doc.strokeColor)) {
                    let isClosed = false;
                    for (let rawPath of doc.rawPaths)
                        if (rawPath.length >= 4 && rawPath[0] == rawPath[rawPath.length - 2] && rawPath[1] == rawPath[rawPath.length - 1])
                            isClosed = true;
                    if (isClosed || !op.filterFillColor) {
                        let clipperPaths = rawPathsToClipperPaths(doc.rawPaths, doc.scale[0], doc.scale[1], doc.translate[0], doc.translate[1]);
                        if (isClosed)
                            geometry = union(geometry, clipperPaths);
                        else
                            openGeometry = openGeometry.concat(clipperPaths);
                    }
                }
            }
            if (doc.isRoot && doc.type === 'image' && !isTab) {
                let cache = documentCacheHolder.cache.get(doc.id);
                if (cache && cache.imageLoaded)
                    docsWithImages.push(Object.assign([], doc, { image: cache.image }));
            }
            for (let child of doc.children)
                examineDocTree(isTab, child);
        }
        for (let id of op.documents)
            examineDocTree(false, id);
        for (let id of op.tabDocuments)
            examineDocTree(true, id);

        if (op.type === 'Laser Cut' || op.type === 'Laser Cut Inside' || op.type === 'Laser Cut Outside') {
            let g = getLaserCutGcodeFromOp(settings, opIndex, op, geometry, openGeometry, tabGeometry, showAlert);
            if (!g)
                return '';
            gcode += g;
        } else if (op.type.substring(0, 5) === 'Mill ') {
            let g = getMillGcodeFromOp(opIndex, op, geometry, openGeometry, tabGeometry, showAlert);
            if (!g)
                return '';
            gcode += g;
        }
    } // opIndex

    gcode += settings.gcodeEnd;
    return gcode;
} // getGcode
