const quizScoring = (() => {
    const evaluate = (answers, questions, types) => {
        const answerTags = new Set(Object.entries(answers).flatMap(([key, value]) => {
            const question = questions.find(question => question.key === key);
            const option = question?.options?.find(option => option.value === value);
            return option?.tags ?? [];
        }));

        let typeName = null;
        let type = null;
        let maxScore = 0;

        for (const [name, candidate] of Object.entries(types)) {
            let score = 0;
            for (const [tag, weight] of Object.entries(candidate.tagWeights ?? {})) {
                if (answerTags.has(tag)) score += weight;
            }
            if (score > maxScore) {
                maxScore = score;
                typeName = name;
                type = candidate;
            }
        }

        const matchTags = new Set([...answerTags, ...Object.keys(type?.tagWeights ?? {})]);
        return { typeName, type, matchTags };
    };

    const scoreProperty = (property, tags, { favorites, stars, dislikes }, random = Math.random) => {
        const commonTags = property.tags.filter(tag => tags.has(tag));
        let score = 30;
        score += (commonTags.length / tags.size) * 50;
        score += commonTags.length * 8;

        if (favorites.includes(property.id)) score += 15;
        if (stars.includes(property.id)) score += 25;
        if (dislikes.includes(property.id)) score -= 35;

        const randomFactor = Math.floor(random() * 17) - 8;
        return Math.max(0, Math.min(100, Math.round(score + randomFactor)));
    };

    return { evaluate, scoreProperty };
})();
