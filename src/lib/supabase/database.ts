import { supabase } from './client';

export const fetchData = async <T>(
  tableName: string,
  options?: {
    columns?: string;
    filter?: { column: string; value: any };
    limit?: number;
    orderBy?: { column: string; ascending?: boolean };
  }
) => {
  let query = supabase.from(tableName).select(options?.columns || '*');

  if (options?.filter) {
    query = query.eq(options.filter.column, options.filter.value);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    });
  }

  const { data, error } = await query;
  
  if (error) {
    console.error(`Error fetching from ${tableName}:`, error);
    throw error;
  }
  
  return data as T[];
};

export const insertData = async <T>(
  tableName: string,
  data: Record<string, any>
) => {
  const { data: insertedData, error } = await supabase
    .from(tableName)
    .insert(data)
    .select();
  
  if (error) {
    console.error(`Error inserting into ${tableName}:`, error);
    throw error;
  }
  
  return insertedData?.[0] as T;
};

export const updateData = async <T>(
  tableName: string,
  id: string | number,
  data: Record<string, any>,
  idColumn: string = 'id'
) => {
  const { data: updatedData, error } = await supabase
    .from(tableName)
    .update(data)
    .eq(idColumn, id)
    .select();
  
  if (error) {
    console.error(`Error updating ${tableName}:`, error);
    throw error;
  }
  
  return updatedData?.[0] as T;
};

export const deleteData = async (
  tableName: string,
  id: string | number,
  idColumn: string = 'id'
) => {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq(idColumn, id);
  
  if (error) {
    console.error(`Error deleting from ${tableName}:`, error);
    throw error;
  }
  
  return true;
}; 