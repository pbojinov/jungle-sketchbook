(function exposeGeometry(root, factory) {
  const geometry = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = geometry;
  } else {
    root.SketchGeometry = geometry;
  }
})(typeof globalThis === 'object' ? globalThis : this, function createGeometry() {
  function solveLinearSystem(matrix, values) {
    const size = values.length;

    for (let column = 0; column < size; column += 1) {
      let pivotRow = column;
      for (let row = column + 1; row < size; row += 1) {
        if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivotRow][column])) {
          pivotRow = row;
        }
      }

      [matrix[column], matrix[pivotRow]] = [matrix[pivotRow], matrix[column]];
      [values[column], values[pivotRow]] = [values[pivotRow], values[column]];

      const pivot = matrix[column][column];
      if (Math.abs(pivot) < 1e-10) {
        throw new Error('Corner geometry is degenerate');
      }

      for (let index = column; index < size; index += 1) {
        matrix[column][index] /= pivot;
      }
      values[column] /= pivot;

      for (let row = 0; row < size; row += 1) {
        if (row === column) continue;
        const factor = matrix[row][column];
        for (let index = column; index < size; index += 1) {
          matrix[row][index] -= factor * matrix[column][index];
        }
        values[row] -= factor * values[column];
      }
    }

    return values;
  }

  function createHomography(destinationPoints, sourcePoints) {
    const matrix = [];
    const values = [];

    for (let index = 0; index < 4; index += 1) {
      const [u, v] = destinationPoints[index];
      const [x, y] = sourcePoints[index];
      matrix.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
      values.push(x);
      matrix.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
      values.push(y);
    }

    return [...solveLinearSystem(matrix, values), 1];
  }

  function mapHomography(homography, u, v) {
    const denominator = homography[6] * u + homography[7] * v + homography[8];
    return [
      (homography[0] * u + homography[1] * v + homography[2]) / denominator,
      (homography[3] * u + homography[4] * v + homography[5]) / denominator,
    ];
  }

  function isValidQuadrilateral(points, canvasWidth, canvasHeight) {
    if (points.length !== 4) return false;

    const crossProducts = [];
    for (let index = 0; index < 4; index += 1) {
      const first = points[index];
      const second = points[(index + 1) % 4];
      const third = points[(index + 2) % 4];
      crossProducts.push(
        (second.x - first.x) * (third.y - second.y) -
          (second.y - first.y) * (third.x - second.x),
      );
    }

    const signedArea = points.reduce((sum, point, index) => {
      const next = points[(index + 1) % 4];
      return sum + point.x * next.y - point.y * next.x;
    }, 0);
    const area = Math.abs(signedArea) / 2;

    return (
      crossProducts.every((value) => value > 0) &&
      area > canvasWidth * canvasHeight * 0.05
    );
  }

  return {
    createHomography,
    isValidQuadrilateral,
    mapHomography,
    solveLinearSystem,
  };
});
