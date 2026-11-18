const propertyFilters = (() => {
    // 距離計算関数（ハヴァサイン公式）
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // 地球の半径（km）
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    const filterProperties = (properties, filters, userLocation) => {
        let result = [...properties];
        const { sort, tags, tagMode, maxPrice, maxAge, prefecture, city } = filters;

        // Filter
        result = result.filter(p => p.price <= maxPrice && p.age <= maxAge);

        // 地域フィルター
        if (prefecture) {
            result = result.filter(p => {
                const match = p.address.match(/^([^都道府県]{1,4}[都道府県])/);
                const propPrefecture = match ? match[1] : p.address.split(' ')[0];
                return propPrefecture === prefecture;
            });
        }

        if (city && prefecture) {
            result = result.filter(p => {
                // 都道府県の後の部分から市区町村を抽出
                const prefectureMatch = p.address.match(/^([^都道府県]{1,4}[都道府県])/);
                if (prefectureMatch) {
                    const remaining = p.address.substring(prefectureMatch[1].length);
                    const cityMatch = remaining.match(/^([^区市町村]{1,10}[区市町村])/);
                    return cityMatch ? cityMatch[1] === city : false;
                }
                const addressParts = p.address.split(' ');
                return addressParts.length > 1 ? addressParts[1] === city : false;
            });
        }

        if (tags.length > 0) {
            if (tagMode === 'AND') {
                result = result.filter(p => tags.every(tag => p.tags.includes(tag)));
            } else { // OR
                result = result.filter(p => tags.some(tag => p.tags.includes(tag)));
            }
        }

        // Sort
        result.sort((a, b) => {
            switch(sort) {
                case 'match_desc': return (b.matchScore || 0) - (a.matchScore || 0);
                case 'new_desc': return b.id - a.id; // IDで代用
                case 'price_asc': return a.price - b.price;
                case 'price_desc': return b.price - a.price;
                case 'distance_asc':
                    if (userLocation) {
                        const distanceA = calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            a.coordinates[0],
                            a.coordinates[1]
                        );
                        const distanceB = calculateDistance(
                            userLocation.lat,
                            userLocation.lng,
                            b.coordinates[0],
                            b.coordinates[1]
                        );
                        return distanceA - distanceB;
                    } else {
                        // 現在地が取得できない場合はマッチ度順
                        return (b.matchScore || 0) - (a.matchScore || 0);
                    }
                default: return 0;
            }
        });

        return result;
    };

    return { filterProperties, calculateDistance };
})();
