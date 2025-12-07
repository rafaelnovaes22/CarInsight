/**
 * String Utilities
 * 
 * Common string manipulation functions used across the vehicle expert agent.
 */

/**
 * Capitalize the first letter of a string
 * 
 * @param str - The string to capitalize
 * @returns The string with first letter capitalized
 * 
 * @example
 * capitalize('civic') // 'Civic'
 * capitalize('') // ''
 */
export const capitalize = (str: string): string => {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
};

/**
 * Format price in Brazilian currency format
 * 
 * @param price - The price in number
 * @returns Formatted price string
 * 
 * @example
 * formatPrice(89990) // 'R$ 89.990'
 */
export const formatPrice = (price: number): string => {
    return `R$ ${price.toLocaleString('pt-BR')}`;
};

/**
 * Format mileage in Brazilian format
 * 
 * @param km - The mileage in kilometers
 * @returns Formatted mileage string
 * 
 * @example
 * formatMileage(123456) // '123.456 km'
 */
export const formatMileage = (km: number): string => {
    return `${km.toLocaleString('pt-BR')} km`;
};
