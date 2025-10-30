import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

const responsiveSize = (size) => {
  const scale = width / 375;
  return Math.round(size * scale);
};

const ResponsiveMenuHeader = ({ 
  title, 
  onClose, 
  user,
  userRole = 'student'
}) => {
  return (
    <View style={styles.menuHeader}>
      <View style={styles.menuHeaderContent}>
        <Image 
          source={require('../assets/logo-small.png')} 
          style={styles.menuLogo}
          resizeMode="contain"
        />
        <Text style={styles.menuTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="close" size={responsiveSize(24)} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user.full_name || 'User'}
          </Text>
          <Text style={styles.userRole}>
            {userRole === 'admin' ? 'Administrator' : 'Student'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  menuHeader: {
    backgroundColor: '#dc3545',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  menuHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSize(16),
    paddingVertical: responsiveSize(12),
  },
  menuLogo: {
    width: responsiveSize(25),
    height: responsiveSize(25),
    marginRight: responsiveSize(10),
  },
  menuTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  closeButton: {
    padding: responsiveSize(4),
  },
  userInfo: {
    paddingHorizontal: responsiveSize(16),
    paddingBottom: responsiveSize(12),
  },
  userName: {
    fontSize: responsiveSize(16),
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: responsiveSize(2),
  },
  userRole: {
    fontSize: responsiveSize(12),
    color: 'rgba(255,255,255,0.8)',
  },
});

export default ResponsiveMenuHeader;