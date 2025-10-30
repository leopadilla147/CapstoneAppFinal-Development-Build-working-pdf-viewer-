import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

// Responsive sizing function
const responsiveSize = (size) => {
  const scale = width / 375; // 375 is standard iPhone width
  return Math.round(size * scale);
};

const ResponsiveHeader = ({ 
  title, 
  onBack, 
  showBackButton = true,
  rightComponent,
  backgroundColor = '#dc3545'
}) => {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor }}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      <View style={[styles.header, { backgroundColor }]}>
        <View style={styles.headerLeft}>
          {showBackButton && onBack && (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={onBack}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="arrow-left" size={responsiveSize(24)} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        
        <View style={styles.headerRight}>
          {rightComponent || <View style={styles.headerSpacer} />}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: responsiveSize(56),
    paddingHorizontal: responsiveSize(16),
    borderBottomLeftRadius: responsiveSize(12),
    borderBottomRightRadius: responsiveSize(12),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerLeft: {
    width: responsiveSize(40),
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: responsiveSize(40),
    alignItems: 'flex-end',
  },
  backButton: {
    padding: responsiveSize(4),
  },
  headerTitle: {
    fontSize: responsiveSize(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSpacer: {
    width: responsiveSize(24),
  },
});

export default ResponsiveHeader;