// Fuzzy matching for the search box: "git" finds GitHub, "tci" Travis CI, "conf" Confluence,
// "pool car" a page titled "POOL CAR PROGLOVE".

const WORD_BREAK = /[\s\-_./:·|—–,()]+/;

/** Can `word` be spelled from the starts of `words`, in order? "tci" from travis + ci, "ghac" from github + actions. */
function prefixChain(word, words, from = 0) {
    if (!word) return true;
    for (let i = from; i < words.length && i < from + 6; i++) {
        let shared = 0;
        while (shared < word.length && shared < words[i].length && word[shared] === words[i][shared]) shared++;
        for (let take = shared; take > 0; take--) {
            if (prefixChain(word.slice(take), words, i + 1)) return true;
        }
    }
    return false;
}

/** How well one query word matches `text`, 0 to 100. */
function wordScore(word, text) {
    if (!text) return 0;
    if (text === word) return 100;
    if (text.startsWith(word)) return 92 - Math.min(10, (text.length - word.length) * 0.4);

    const words = text.split(WORD_BREAK).filter(Boolean);
    if (words.some((w) => w.startsWith(word))) return 78;
    if (word.length >= 2 && words.length > 1 && prefixChain(word, words.slice(0, 8))) return 74;
    if (text.includes(word)) return 60;

    // Letters in order with gaps ("tvci" in "travis ci"), only for longer words so short ones don't match noise.
    if (word.length >= 3) {
        let at = -1;
        let first = -1;
        for (const ch of word) {
            at = text.indexOf(ch, at + 1);
            if (at === -1) return 0;
            if (first === -1) first = at;
        }
        const span = at - first + 1;
        return 30 + 20 * (word.length / span);
    }
    return 0;
}

/**
 * Score `query` against weighted fields, e.g. [[name, 1], [host, 0.8]]. Every word of the query has to
 * match some field; the result is the average of each word's best match (0 when any word misses).
 */
export function score(query, fields) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return 0;
    let sum = 0;
    for (const word of words) {
        let best = 0;
        for (const [text, weight] of fields) best = Math.max(best, wordScore(word, (text ?? '').toLowerCase()) * weight);
        if (!best) return 0;
        sum += best;
    }
    return sum / words.length;
}

/** True when `query` starts the name or spells it from its words' starts: strong enough to be what Enter opens. */
export function isStrong(query, name) {
    const q = query.toLowerCase();
    const n = name.toLowerCase();
    if (q.length < 2 || /\s/.test(q)) return false;
    const words = n.split(WORD_BREAK).filter(Boolean);
    return n.startsWith(q) || (words.length > 1 && prefixChain(q, words));
}
