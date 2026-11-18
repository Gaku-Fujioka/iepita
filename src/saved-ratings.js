const savedRatings = (() => {
    const kinds = ['favorites', 'stars', 'dislikes'];
    const storageKey = kind => `iepita_${kind}`;
    const backupKey = kind => `${storageKey(kind)}_backup`;

    const save = (kind, ids) => {
        const json = JSON.stringify(ids);
        try {
            localStorage.setItem(storageKey(kind), json);
        } catch (error) {
            console.error(`評価の保存に失敗しました (${kind})`, error);
            try {
                sessionStorage.setItem(backupKey(kind), json);
            } catch (backupError) {
                console.error(`評価のバックアップに失敗しました (${kind})`, backupError);
            }
        }
    };

    const load = (kind) => {
        try {
            return JSON.parse(localStorage.getItem(storageKey(kind)) || '[]');
        } catch (error) {
            console.error(`評価の読み込みに失敗しました (${kind})`, error);
            try {
                return JSON.parse(sessionStorage.getItem(backupKey(kind)) || '[]');
            } catch (backupError) {
                console.error(`評価のバックアップを読み込めませんでした (${kind})`, backupError);
                return [];
            }
        }
    };

    const saveAll = (ratings) => {
        for (const kind of kinds) save(kind, ratings[kind]);
    };

    const loadAll = () => Object.fromEntries(kinds.map(kind => [kind, load(kind)]));

    const clearAll = () => {
        for (const kind of kinds) {
            localStorage.removeItem(storageKey(kind));
            sessionStorage.removeItem(backupKey(kind));
        }
    };

    return { save, saveAll, loadAll, clearAll };
})();
