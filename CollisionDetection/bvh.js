function TreeNode(triangles, left = null, right = null, boxmin = null, boxmax = null) {
    this.triangles = triangles;
    this.boxmin = boxmin;
    this.boxmax = boxmax;
    this.left = left;
    this.right = right;
}

TreeNode.prototype.buildTriangleTree = function (globject) {
    const { positions, triangles } = globject;

    function computeTriangleCenter(indices) {
        let center = vec3.create();
        vec3.add(positions[indices[0]], positions[indices[1]], center);
        vec3.add(center, positions[indices[2]]);
        vec3.scale(center, 1 / 3);
        return center;
    }

    function buildTree(triangleIndices) {
        if (triangleIndices.length === 1) return new TreeNode(triangleIndices);

        let axisBounds = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] };
        triangleIndices.forEach(indices => {
            const center = computeTriangleCenter(indices);
            axisBounds.x = [Math.min(axisBounds.x[0], center[0]), Math.max(axisBounds.x[1], center[0])];
            axisBounds.y = [Math.min(axisBounds.y[0], center[1]), Math.max(axisBounds.y[1], center[1])];
            axisBounds.z = [Math.min(axisBounds.z[0], center[2]), Math.max(axisBounds.z[1], center[2])];
        });

        let dominantAxis = ['x', 'y', 'z'].reduce((dominant, axis) => {
            return (axisBounds[axis][1] - axisBounds[axis][0]) > (axisBounds[dominant][1] - axisBounds[dominant][0]) ? axis : dominant;
        }, 'x');

        triangleIndices.sort((a, b) => computeTriangleCenter(a)[dominantAxis] - computeTriangleCenter(b)[dominantAxis]);

        let median = Math.floor(triangleIndices.length / 2);
        let leftTriangles = triangleIndices.slice(0, median);
        let rightTriangles = triangleIndices.slice(median);

        return new TreeNode(null, buildTree(leftTriangles), buildTree(rightTriangles));
    }

    let triangleGroups = [];
    for (let i = 0; i < triangles.length; i += 3) 
    {
        triangleGroups.push([triangles[i], triangles[i + 1], triangles[i + 2]]);
    }

    return buildTree(triangleGroups);
};

TreeNode.prototype.updateAABBs = function (virtualObject)
{
    positions = virtualObject.globject.positions;
    const posmatrix = mat4.create();
    mat4.identity(posmatrix);
    virtualObject.applyTranformations(posmatrix);

    function computeAABB(triangleIndices) 
    {
        let boxmin = vec3.create();
        let boxmax = vec3.create();
        boxmin[0] = boxmin[1] = boxmin[2] = Number.MAX_VALUE;
        boxmax[0] = boxmax[1] = boxmax[2] = -Number.MAX_VALUE;
        let pos=vec3.create();
        
        triangleIndices.forEach(indices => {
            indices.forEach(index => {
                mat4.multiplyVec3(posmatrix, positions[index], pos);
                vec3.min(boxmin, pos);
                vec3.max(boxmax, pos);
            });
        });

        return { boxmin, boxmax };
    }

    if (this.left === null && this.right === null) {
        const { boxmin, boxmax } = computeAABB(this.triangles);
        this.boxmin = boxmin;
        this.boxmax = boxmax;
    } else {
        if (this.left) this.left.updateAABBs(virtualObject);
        if (this.right) this.right.updateAABBs(virtualObject);
        if (!this.boxmin) this.boxmin = vec3.create();
        if (!this.boxmax) this.boxmax = vec3.create();
        vec3.min(this.left.boxmin, this.right.boxmin, this.boxmin);
        vec3.max(this.left.boxmax, this.right.boxmax, this.boxmax);
    }
};

TreeNode.prototype.checkCollisions = function (otherNode, collisions) {

    function computeVolume(boxmin, boxmax) {
        return (boxmax[0] - boxmin[0]) * (boxmax[1] - boxmin[1]) * (boxmax[2] - boxmin[2]);
    }

    if (!this.compareAABB(otherNode)) return;

    if (!this.left && !this.right && !otherNode.left && !otherNode.right) {
        collisions.push({ trianglesA: this.triangles, trianglesB: otherNode.triangles });
        return;
    }

    const volumeThis = computeVolume(this.boxmin, this.boxmax);
    const volumeOther = computeVolume(otherNode.boxmin, otherNode.boxmax);

    if (volumeThis > volumeOther) {
        if (!this.left && !this.right) {
            if (otherNode.left) this.checkCollisions(otherNode.left, collisions);
            if (otherNode.right) this.checkCollisions(otherNode.right, collisions);
        } else {
            if (this.left) this.left.checkCollisions(otherNode, collisions);
            if (this.right) this.right.checkCollisions(otherNode, collisions);
        }
    } else {
        if (!otherNode.left && !otherNode.right) {
            if (this.left) this.left.checkCollisions(otherNode, collisions);
            if (this.right) this.right.checkCollisions(otherNode, collisions);
        } else {
            if (otherNode.left) this.checkCollisions(otherNode.left, collisions);
            if (otherNode.right) this.checkCollisions(otherNode.right, collisions);
        }
    }
};

TreeNode.prototype.compareAABB = function (otherNode) {
    return !(
        this.boxmin[0] > otherNode.boxmax[0] || this.boxmax[0] < otherNode.boxmin[0] || 
        this.boxmin[1] > otherNode.boxmax[1] || this.boxmax[1] < otherNode.boxmin[1] || 
        this.boxmin[2] > otherNode.boxmax[2] || this.boxmax[2] < otherNode.boxmin[2]    
    );
};

function checkPlaneSeparation(triangle1, triangle2) {
    function computeNormal(v1, v2, v3) {
        let edge1 = vec3.create();
        let edge2 = vec3.create();
        vec3.subtract(v2, v1, edge1);
        vec3.subtract(v3, v1, edge2);
        let normal = vec3.create();
        vec3.cross(edge1, edge2, normal);
        return normal;
    }

    function signedDistance(point, planePoint, planeNormal) {
        let diff = vec3.create();
        vec3.subtract(point, planePoint, diff);
        return vec3.dot(diff, planeNormal);
    }

    // Décompose les triangles
    const [A1, B1, C1] = triangle1;
    const [A2, B2, C2] = triangle2;

    // Calculer la normale du premier triangle
    const normal1 = computeNormal(A1, B1, C1);

    // Vérifier les distances signées des sommets du deuxième triangle
    const signs = [
        signedDistance(A2, A1, normal1),
        signedDistance(B2, A1, normal1),
        signedDistance(C2, A1, normal1),
    ];

    // Si tous les signes sont identiques, pas d'intersection
    const allPositive = signs.every(s => s > 0);
    const allNegative = signs.every(s => s < 0);

    return !(allPositive || allNegative); // Retourne vrai si les sommets sont de part et d'autre
}
