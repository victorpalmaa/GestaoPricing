import { supabase } from '@/lib/utils';

export const fetchNotifications = async () => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (error) {
      console.warn('Error fetching notifications:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Exception fetching notifications:', error);
    return [];
  }
};

export const addNotification = async (type, message, userId = null) => {
  try {
    // Tenta inserir a notificação. Se a tabela não existir, vai falhar (o que é esperado se o BD não estiver atualizado)
    const { error } = await supabase.from('notifications').insert({
      type,
      message,
      read: false,
      created_at: new Date().toISOString(),
      user_id: userId
    });
    
    if (error) {
      console.error('Error adding notification:', error);
    }
  } catch (error) {
    console.error('Exception adding notification:', error);
  }
};

export const markNotificationAsRead = async (id) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
      
    if (error) {
      console.error('Error marking notification as read:', error);
    }
  } catch (error) {
    console.error('Exception marking notification as read:', error);
  }
};
