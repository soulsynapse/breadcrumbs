import type { Primitive } from "src/interfaces";

export const swap_items = <T>(i: number, j: number, arr: T[]) => {
	const max = arr.length - 1;
	if (i < 0 || i > max || j < 0 || j > max) return arr;

	const tmp = arr[i];
	arr[i] = arr[j];
	arr[j] = tmp;

	return arr;
};

export const ensure_is_array = <T>(maybe_array: T | T[]): T[] => {
	if (Array.isArray(maybe_array)) return maybe_array;
	return [maybe_array];
};

export const ensure_square_array = <T, F>(
	arr: T[][],
	fill: F,
	pre?: boolean,
): (T | F)[][] => {
	const max_width = Math.max(...arr.map((row) => row.length));

	return arr.map((row) => {
		const diff = max_width - row.length;

		if (pre) {
			return Array(diff).fill(fill).concat(row);
		} else {
			return row.concat(Array(diff).fill(fill));
		}
	});
};

/** NOTE: Doesn't _assume_ square, but will make the output square.
 * Don't rely on this tho, since the types won't reflect the filler values */
export const transpose = <T>(arr: T[][]): T[][] => {
	const transposed: T[][] = [];

	if (!arr.length) return transposed;

	for (let i = 0; i < arr.at(0)!.length; i++) {
		transposed.push([]);

		for (let j = 0; j < arr.length; j++) {
			transposed[i].push(arr[j][i]);
		}
	}

	return transposed;
};

/**
 * Builds an array of runs of identical values in the given array.
 * @param arr - The array to analyze.
 * @returns `runs` - first and last indices of each run of identical values (both inclusive).
 */
export const gather_by_runs = <I, V extends Primitive>(
	arr: I[],
	get_value: (item: I) => V,
) => {
	const runs: {
		value: V;
		first: number;
		last: number;
	}[] = [];

	for (let i = 0; i < arr.length; i++) {
		const last_run = runs.last();
		const value = get_value(arr[i]);

		if (last_run && last_run.value === value) {
			last_run.last = i;
		} else {
			runs.push({ value, first: i, last: i });
		}
	}

	return runs;
};

export const group_by = <T extends P, S extends string, P = T>(
	list: T[],
	get_value: (item: T) => S,
	project: (item: T) => P = (item) => item as P,
) => {
	const grouped: Partial<Record<S, P[]>> = {};

	list.forEach((item) => {
		const key = get_value(item);
		// WARN: Doesn't group undefined values
		if (key === undefined) return;

		const group = grouped[key];
		const projected = project(item);

		if (!group) grouped[key] = [projected];
		else group.push(projected);
	});

	return grouped;
};

export const remove_duplicates = <T>(arr: T[]): T[] => {
	const set = new Set(arr);
	return Array.from(set);
};
