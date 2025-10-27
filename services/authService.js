// services/authService.js
import { supabase } from '../config/supabase';

export const authService = {
  async loginUser(username, password) {
    try {
      // First, check if user exists in users table
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error || !user) {
        throw new Error('Invalid username or password');
      }

      // Verify password
      if (user.password !== password) {
        throw new Error('Invalid username or password');
      }

      // Check if user is a student
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.user_id)
        .maybeSingle();

      // Check if user is an admin
      const { data: admin, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', user.user_id)
        .maybeSingle();

      let userRole = 'user'; // Default role
      let userData = {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: userRole,
        created_at: user.created_at
      };

      // If user is a student, add student data
      if (student && !studentError) {
        userRole = 'student';
        userData = {
          ...userData,
          role: userRole,
          student_id: student.student_id,
          year_level: student.year_level,
          college_department: student.college_department,
          course: student.course
        };
      }

      // If user is an admin, add admin data
      if (admin && !adminError) {
        userRole = 'admin';
        userData = {
          ...userData,
          role: userRole,
          admin_id: admin.admin_id,
          position: admin.position,
          college_department: admin.college_department
        };
      }

      return userData;

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  async registerUser(userData) {
    try {
      console.log('Starting registration with data:', userData);

      // Check if username exists
      const { data: existingUsername, error: usernameError } = await supabase
        .from('users')
        .select('username')
        .eq('username', userData.username)
        .maybeSingle();

      if (usernameError) {
        console.error('Username check error:', usernameError);
        throw new Error('Error checking username availability');
      }

      if (existingUsername) {
        throw new Error('Username already exists. Please choose a different one.');
      }

      // Check if email exists
      const { data: existingEmail, error: emailError } = await supabase
        .from('users')
        .select('email')
        .eq('email', userData.email)
        .maybeSingle();

      if (emailError) {
        console.error('Email check error:', emailError);
        throw new Error('Error checking email availability');
      }

      if (existingEmail) {
        throw new Error('Email already registered. Please use a different email.');
      }

      // If student, check if student ID already exists
      if (userData.isStudent) {
        const { data: existingStudentId, error: studentIdError } = await supabase
          .from('students')
          .select('student_id')
          .eq('student_id', userData.student_id)
          .maybeSingle();

        if (studentIdError) {
          console.error('Student ID check error:', studentIdError);
          throw new Error('Error checking student ID availability');
        }

        if (existingStudentId) {
          throw new Error('Student ID already registered. Please use a different student ID.');
        }
      }

      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            username: userData.username,
            password: userData.password,
            full_name: userData.full_name,
            email: userData.email,
            phone: userData.phone || null,
            birthdate: userData.birthdate || null // Add birthdate here
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('User insertion error:', insertError);
        throw new Error(`Failed to create user account: ${insertError.message}`);
      }

      console.log('User created successfully:', newUser);

      // If user is a student, insert into students table
      if (userData.isStudent) {
        console.log('Creating student record with data:', {
          user_id: newUser.user_id,
          student_id: userData.student_id, // Add student_id here
          year_level: userData.year_level,
          college_department: userData.college_department,
          course: userData.course
        });

        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert([
            {
              user_id: newUser.user_id,
              student_id: userData.student_id, // Add student_id here
              year_level: userData.year_level,
              college_department: userData.college_department,
              course: userData.course
            }
          ])
          .select()
          .single();

        if (studentError) {
          console.error('Student insertion error:', studentError);
          // If student insertion fails, delete the user to maintain consistency
          await supabase.from('users').delete().eq('user_id', newUser.user_id);
          throw new Error(`Failed to create student record: ${studentError.message}`);
        }

        console.log('Student record created successfully:', newStudent);

        return {
          user_id: newUser.user_id,
          username: newUser.username,
          full_name: newUser.full_name,
          email: newUser.email,
          phone: newUser.phone,
          role: 'student',
          student_id: newStudent.student_id,
          year_level: newStudent.year_level,
          college_department: newStudent.college_department,
          course: newStudent.course,
          created_at: newUser.created_at
        };
      }

      // If not a student, just return basic user data
      console.log('Non-student user created successfully');
      return {
        user_id: newUser.user_id,
        username: newUser.username,
        full_name: newUser.full_name,
        email: newUser.email,
        phone: newUser.phone,
        role: 'user',
        created_at: newUser.created_at
      };

    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  async validateSession(userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (error || !user) {
        throw new Error('Session expired or user not found');
      }

      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      throw error;
    }
  },

  async verifyPassword(username, password) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (error || !user) {
        throw new Error('Invalid username or password');
      }

      if (user.password !== password) {
        throw new Error('Invalid password');
      }

      return user;
    } catch (error) {
      console.error('Password verification error:', error);
      throw error;
    }
  }
};